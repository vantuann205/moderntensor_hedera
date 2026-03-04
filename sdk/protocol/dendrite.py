"""
ModernTensor Dendrite — Validator HTTP Client

Validators use Dendrite to send tasks to miners' Axon servers over HTTP.
Supports single task delivery and broadcast to multiple miners.

Architecture:
    Validator → Dendrite (this) → HTTP → Axon (miner server) → Handler

For ModernTensor on Hedera — Hello Future Hackathon 2026
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import time
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

logger = logging.getLogger(__name__)


class DendriteResult:
    """Result from a single Dendrite request to a miner's Axon."""

    def __init__(
        self,
        miner_id: str,
        endpoint: str,
        response: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
        latency: float = 0.0,
    ):
        self.miner_id = miner_id
        self.endpoint = endpoint
        self.response = response
        self.error = error
        self.latency = latency

    @property
    def success(self) -> bool:
        return self.error is None and self.response is not None

    @property
    def output(self) -> Optional[Dict[str, Any]]:
        if self.response:
            return self.response.get("output")
        return None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "miner_id": self.miner_id,
            "endpoint": self.endpoint,
            "success": self.success,
            "latency": round(self.latency, 3),
            "output": self.output,
            "error": self.error,
        }


class Dendrite:
    """
    Validator's HTTP client — sends tasks to miners' Axon servers.

    Example:
        dendrite = Dendrite(validator_id="0.0.9999", timeout=30)

        # Send to a single miner
        result = dendrite.send_task(
            endpoint="http://1.2.3.4:8091",
            miner_id="0.0.1001",
            task_id="task-abc",
            task_type="code_review",
            payload={"code": "def foo(): ..."},
        )
        print(result.output)  # {"analysis": "...", "score": 0.85}

        # Broadcast to multiple miners
        results = dendrite.broadcast(
            miners=[
                {"miner_id": "0.0.1001", "endpoint": "http://1.2.3.4:8091"},
                {"miner_id": "0.0.1002", "endpoint": "http://5.6.7.8:8091"},
            ],
            task_id="task-xyz",
            task_type="code_review",
            payload={"code": "..."},
        )
    """

    def __init__(
        self,
        validator_id: str = "0.0.0",
        timeout: float = 30.0,
        auth_secret: Optional[str] = None,
        max_workers: int = 8,
    ):
        """
        Args:
            validator_id: This validator's Hedera account ID
            timeout: Request timeout in seconds
            auth_secret: Shared HMAC secret for Axon authentication
            max_workers: Max threads for broadcast concurrency
        """
        self.validator_id = validator_id
        self.timeout = timeout
        self.auth_secret = auth_secret
        self.max_workers = max_workers
        self._total_requests = 0
        self._total_errors = 0

    def send_task(
        self,
        endpoint: str,
        miner_id: str,
        task_id: str,
        task_type: str,
        payload: Dict[str, Any],
    ) -> DendriteResult:
        """
        Send a task to a single miner's Axon server.

        Args:
            endpoint: Miner's Axon HTTP endpoint (e.g., "http://1.2.3.4:8091")
            miner_id: Target miner ID
            task_id: Unique task identifier
            task_type: Type of task (e.g., "code_review")
            payload: Task data to send

        Returns:
            DendriteResult with response or error
        """
        url = f"{endpoint.rstrip('/')}/task"
        body = json.dumps(
            {
                "task_id": task_id,
                "task_type": task_type,
                "payload": payload,
                "validator_id": self.validator_id,
                "timestamp": time.time(),
            }
        ).encode("utf-8")

        self._total_requests += 1
        start_time = time.time()

        try:
            headers = {
                "Content-Type": "application/json",
                "X-Validator-ID": self.validator_id,
            }

            # Add HMAC signature if auth secret is configured
            if self.auth_secret:
                sig = hmac.new(
                    self.auth_secret.encode(),
                    self.validator_id.encode(),
                    hashlib.sha256,
                ).hexdigest()
                headers["X-Auth-Signature"] = sig

            req = Request(
                url,
                data=body,
                headers=headers,
                method="POST",
            )

            with urlopen(req, timeout=self.timeout) as resp:
                response_body = resp.read().decode("utf-8")
                response_data = json.loads(response_body)

            latency = time.time() - start_time

            logger.info(
                "Dendrite → %s: task %s completed in %.2fs",
                miner_id,
                task_id[:8],
                latency,
            )

            return DendriteResult(
                miner_id=miner_id,
                endpoint=endpoint,
                response=response_data,
                latency=latency,
            )

        except HTTPError as e:
            latency = time.time() - start_time
            self._total_errors += 1
            error_body = e.read().decode("utf-8", errors="replace")
            logger.warning(
                "Dendrite → %s: HTTP %d — %s",
                miner_id,
                e.code,
                error_body[:200],
            )
            return DendriteResult(
                miner_id=miner_id,
                endpoint=endpoint,
                error=f"HTTP {e.code}: {error_body[:200]}",
                latency=latency,
            )

        except (URLError, TimeoutError, OSError) as e:
            latency = time.time() - start_time
            self._total_errors += 1
            logger.warning(
                "Dendrite → %s: connection failed — %s",
                miner_id,
                e,
            )
            return DendriteResult(
                miner_id=miner_id,
                endpoint=endpoint,
                error=f"Connection failed: {e}",
                latency=latency,
            )

    def check_health(self, endpoint: str) -> bool:
        """
        Check if a miner's Axon is online.

        Args:
            endpoint: Miner's Axon endpoint

        Returns:
            True if the Axon responds to /health
        """
        url = f"{endpoint.rstrip('/')}/health"
        try:
            req = Request(url, method="GET")
            with urlopen(req, timeout=5.0) as resp:
                return resp.status == 200
        except Exception:
            return False

    def broadcast(
        self,
        miners: List[Dict[str, Any]],
        task_id: str,
        task_type: str,
        payload: Dict[str, Any],
    ) -> List[DendriteResult]:
        """
        Send a task to multiple miners simultaneously.

        Args:
            miners: List of dicts with "miner_id" and "endpoint" keys
            task_id: Task identifier
            task_type: Type of task
            payload: Task data

        Returns:
            List of DendriteResult, one per miner
        """
        results: List[DendriteResult] = []
        futures = {}

        with ThreadPoolExecutor(max_workers=min(self.max_workers, len(miners))) as pool:
            for miner in miners:
                mid = miner.get("miner_id", "unknown")
                ep = miner.get("endpoint", "")
                if not ep:
                    results.append(
                        DendriteResult(
                            miner_id=mid,
                            endpoint="",
                            error="No endpoint configured",
                        )
                    )
                    continue

                fut = pool.submit(
                    self.send_task,
                    endpoint=ep,
                    miner_id=mid,
                    task_id=task_id,
                    task_type=task_type,
                    payload=payload,
                )
                futures[fut] = mid

            for fut in as_completed(futures):
                try:
                    results.append(fut.result())
                except Exception as exc:
                    results.append(
                        DendriteResult(
                            miner_id=futures[fut],
                            endpoint="",
                            error=f"Thread error: {exc}",
                        )
                    )

        logger.info(
            "Dendrite broadcast: %d miners, %d success, %d failed",
            len(results),
            sum(1 for r in results if r.success),
            sum(1 for r in results if not r.success),
        )
        return results

    def get_stats(self) -> Dict[str, Any]:
        """Get Dendrite client statistics."""
        return {
            "validator_id": self.validator_id,
            "total_requests": self._total_requests,
            "total_errors": self._total_errors,
            "success_rate": round(
                (self._total_requests - self._total_errors)
                / max(1, self._total_requests),
                4,
            ),
            "timeout": self.timeout,
        }
