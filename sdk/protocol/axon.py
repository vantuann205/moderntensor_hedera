"""
ModernTensor Axon — Miner HTTP Server

Miners run an Axon server to receive tasks from validators over the network.
Validators use Dendrite (HTTP client) to send tasks to miner Axons.

Architecture:
    Validator → Dendrite (HTTP client) → Axon (HTTP server) → Miner Handler

Endpoints:
    POST /task     — Receive a task, process it, return result
    GET  /health   — Liveness check
    GET  /info     — Miner metadata (ID, subnets, capabilities)

For ModernTensor on Hedera — Hello Future Hackathon 2026
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import threading
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

# Type alias: handler receives (task_payload, task_type) and returns output dict
TaskHandler = Callable[[Dict[str, Any], str], Dict[str, Any]]

# Shared secret for HMAC authentication (set via env or config)
_DEFAULT_AUTH_SECRET = "moderntensor-hackathon-2026"


class _AxonRequestHandler(BaseHTTPRequestHandler):
    """Internal HTTP request handler for the Axon server."""

    # Suppress default stderr logging
    def log_message(self, format, *args):
        logger.debug("Axon HTTP: %s", format % args)

    def do_GET(self):
        if self.path == "/health":
            self._respond(
                200,
                {
                    "status": "online",
                    "miner_id": self.server.axon_config["miner_id"],
                    "uptime": round(
                        time.time() - self.server.axon_config["started_at"], 1
                    ),
                    "tasks_processed": self.server.axon_config["tasks_processed"],
                },
            )
        elif self.path == "/info":
            self._respond(
                200,
                {
                    "miner_id": self.server.axon_config["miner_id"],
                    "subnet_ids": self.server.axon_config["subnet_ids"],
                    "capabilities": self.server.axon_config["capabilities"],
                    "version": "1.0.0",
                },
            )
        else:
            self._respond(404, {"error": "Not found"})

    def do_POST(self):
        if self.path == "/task":
            self._handle_task()
        else:
            self._respond(404, {"error": "Not found"})

    def _handle_task(self):
        """Process incoming task from a validator."""
        # Authentication: verify HMAC signature if auth is enabled
        auth_secret = self.server.axon_config.get("auth_secret")
        if auth_secret:
            sig = self.headers.get("X-Auth-Signature", "")
            validator_id = self.headers.get("X-Validator-ID", "")
            expected = hmac.new(
                auth_secret.encode(), validator_id.encode(), hashlib.sha256
            ).hexdigest()
            if not hmac.compare_digest(sig, expected):
                self._respond(403, {"error": "Invalid authentication signature"})
                return

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            request = json.loads(body)
        except (json.JSONDecodeError, ValueError) as e:
            self._respond(400, {"error": f"Invalid JSON: {e}"})
            return

        task_payload = request.get("payload", {})
        task_type = request.get("task_type", "unknown")
        task_id = request.get("task_id", "unknown")

        logger.info(
            "Axon received task %s (type=%s) from validator",
            task_id[:8] if len(task_id) > 8 else task_id,
            task_type,
        )

        handler = self.server.axon_config.get("handler")
        if not handler:
            self._respond(503, {"error": "No handler registered"})
            return

        start_time = time.time()
        try:
            output = handler(task_payload, task_type)
            execution_time = time.time() - start_time

            self.server.axon_config["tasks_processed"] += 1

            self._respond(
                200,
                {
                    "task_id": task_id,
                    "miner_id": self.server.axon_config["miner_id"],
                    "output": output,
                    "execution_time": round(execution_time, 3),
                    "status": "completed",
                },
            )

            logger.info(
                "Task %s completed in %.2fs",
                task_id[:8] if len(task_id) > 8 else task_id,
                execution_time,
            )
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error("Handler error for task %s: %s", task_id[:8], e)
            self._respond(
                500,
                {
                    "task_id": task_id,
                    "error": str(e),
                    "execution_time": round(execution_time, 3),
                    "status": "failed",
                },
            )

    def _respond(self, status_code: int, data: Dict[str, Any]):
        """Send JSON response."""
        body = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class Axon:
    """
    Miner's HTTP server — receives tasks from validators.

    When a miner registers, they expose an Axon endpoint (host:port).
    Validators use Dendrite to connect and send tasks over HTTP.

    Example:
        def my_ai_handler(payload, task_type):
            return {"analysis": "...", "score": 0.85}

        axon = Axon(
            miner_id="0.0.1001",
            handler=my_ai_handler,
            port=8091,
            subnet_ids=[1],
        )
        axon.start()  # Non-blocking, runs in background thread

        # Later...
        axon.stop()
    """

    def __init__(
        self,
        miner_id: str,
        handler: TaskHandler,
        host: str = "0.0.0.0",
        port: int = 8091,
        subnet_ids: Optional[List[int]] = None,
        capabilities: Optional[List[str]] = None,
    ):
        """
        Args:
            miner_id: This miner's Hedera account ID
            handler: Function that processes (payload, task_type) → output dict
            host: Bind address (0.0.0.0 = all interfaces)
            port: Port to listen on
            subnet_ids: Subnets this miner participates in
            capabilities: Task types this miner supports
        """
        self.miner_id = miner_id
        self.handler = handler
        self.host = host
        self.port = port
        self.subnet_ids = subnet_ids or []
        self.capabilities = capabilities or []

        self._server: Optional[HTTPServer] = None
        self._thread: Optional[threading.Thread] = None
        self._running = False
        self._started_at = 0.0
        self._tasks_processed = 0

    @property
    def endpoint(self) -> str:
        """Full HTTP endpoint URL."""
        return f"http://{self.host}:{self.port}"

    @property
    def is_running(self) -> bool:
        return self._running

    def start(self) -> None:
        """Start the Axon server in a background thread."""
        if self._running:
            logger.warning("Axon already running on %s:%d", self.host, self.port)
            return

        self._started_at = time.time()
        self._server = HTTPServer((self.host, self.port), _AxonRequestHandler)

        # Share config with handler via server object
        self._server.axon_config = {
            "miner_id": self.miner_id,
            "handler": self.handler,
            "subnet_ids": self.subnet_ids,
            "capabilities": self.capabilities,
            "started_at": self._started_at,
            "tasks_processed": 0,
        }

        self._thread = threading.Thread(
            target=self._server.serve_forever,
            daemon=True,
        )
        self._running = True
        self._thread.start()

        logger.info(
            "Axon started — miner=%s, endpoint=%s, subnets=%s",
            self.miner_id,
            self.endpoint,
            self.subnet_ids,
        )

    def stop(self) -> None:
        """Stop the Axon server."""
        if self._server:
            self._server.shutdown()
            self._running = False
            if self._thread:
                self._thread.join(timeout=5.0)
            logger.info("Axon stopped — miner=%s", self.miner_id)

    def get_stats(self) -> Dict[str, Any]:
        """Get Axon server statistics."""
        return {
            "miner_id": self.miner_id,
            "endpoint": self.endpoint,
            "is_running": self._running,
            "uptime": (
                round(time.time() - self._started_at, 1) if self._started_at else 0
            ),
            "tasks_processed": (
                self._server.axon_config["tasks_processed"] if self._server else 0
            ),
            "subnet_ids": self.subnet_ids,
        }
