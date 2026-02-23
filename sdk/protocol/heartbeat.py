"""
Miner Heartbeat Module

Generates consistent network activity (TPS) and proves miner liveness
by periodically sending "ping" messages to a dedicated HCS topic.
"""

import time
import json
import threading
import logging
from typing import Optional, Dict, Any
from sdk.hedera.client import HederaClient

logger = logging.getLogger(__name__)

class MinerHeartbeat:
    """
    Background service that sends periodic heartbeats to HCS.
    """

    def __init__(
        self,
        client: HederaClient,
        topic_id: str,
        miner_id: str,
        interval_seconds: float = 60.0,
    ):
        self.client = client
        self.topic_id = topic_id
        self.miner_id = miner_id
        self.interval = interval_seconds

        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._counter = 0

    def start(self):
        """Start the heartbeat loop in a background thread."""
        if self._running:
            return

        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        logger.info(f"MinerHeartbeat started for {self.miner_id} on topic {self.topic_id}")

    def stop(self):
        """Stop the heartbeat loop."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=2.0)
        logger.info("MinerHeartbeat stopped")

    def _run_loop(self):
        """Main loop."""
        while self._running:
            try:
                self._send_beat()
            except Exception as e:
                logger.error(f"Error in heartbeat loop: {e}")

            # Sleep in chunks to allow faster stopping
            for _ in range(int(self.interval)):
                if not self._running:
                    break
                time.sleep(1.0)

    def _send_beat(self):
        """Construct and send a single heartbeat."""
        self._counter += 1

        payload = {
            "type": "heartbeat",
            "miner_id": self.miner_id,
            "timestamp": time.time(),
            "seq": self._counter,
            "status": "ONLINE",
            "version": "1.0.0"
        }

        message = json.dumps(payload)

        # Use async submit to avoid blocking main threads
        self.client.submit_message_async(
            topic_id=self.topic_id,
            message=message,
            callback=self._on_sent
        )

    def _on_sent(self, receipt, error):
        """Callback for submission result."""
        if error:
            logger.warning(f"Heartbeat failed: {error}")
        else:
            logger.debug(f"Heartbeat sent (seq={self._counter})")
