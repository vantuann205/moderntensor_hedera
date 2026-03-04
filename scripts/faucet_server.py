#!/usr/bin/env python3
"""
ModernTensor — Testnet MDT Faucet Server

A simple HTTP server that distributes testnet MDT tokens to developers.
Allows anyone to try the network without purchasing tokens.

Features:
    - Rate limiting (1 request per account per hour)
    - Configurable drip amount (default: 100 MDT)
    - Transaction logging
    - REST API

Endpoints:
    POST /drip       — Request testnet MDT tokens
    GET  /status     — Check faucet status and balance
    GET  /health     — Health check

Usage:
    python scripts/faucet_server.py

    # Request tokens:
    curl -X POST http://localhost:8888/drip \
         -H "Content-Type: application/json" \
         -d '{"account_id": "0.0.12345", "amount": 100}'
"""

import json
import logging
import os
import sys
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from typing import Dict, Optional

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [faucet] %(message)s",
)
logger = logging.getLogger("faucet")

# ---------------------------------------------------------------------------
# Faucet Configuration
# ---------------------------------------------------------------------------

FAUCET_PORT = int(os.getenv("FAUCET_PORT", "8888"))
MAX_DRIP_AMOUNT = float(os.getenv("FAUCET_MAX_DRIP", "500"))
DEFAULT_DRIP = float(os.getenv("FAUCET_DEFAULT_DRIP", "100"))
COOLDOWN_SECONDS = float(os.getenv("FAUCET_COOLDOWN", "3600"))  # 1 hour
DAILY_BUDGET = float(os.getenv("FAUCET_DAILY_BUDGET", "10000"))

# ---------------------------------------------------------------------------
# Faucet State
# ---------------------------------------------------------------------------

class FaucetState:
    """Tracks faucet requests and rate limits."""

    def __init__(self):
        self.last_drip: Dict[str, float] = {}  # account_id -> timestamp
        self.drip_history: list = []
        self.total_distributed: float = 0.0
        self.daily_distributed: float = 0.0
        self.day_start: float = time.time()
        self.hts_service = None

    def can_drip(self, account_id: str, amount: float) -> tuple[bool, str]:
        """Check if a drip is allowed."""
        now = time.time()

        # Daily budget reset
        if now - self.day_start > 86400:
            self.daily_distributed = 0.0
            self.day_start = now

        # Check daily budget
        if self.daily_distributed + amount > DAILY_BUDGET:
            return False, f"Daily budget exhausted ({DAILY_BUDGET} MDT/day)"

        # Check amount limits
        if amount <= 0 or amount > MAX_DRIP_AMOUNT:
            return False, f"Amount must be between 0 and {MAX_DRIP_AMOUNT} MDT"

        # Check cooldown
        last = self.last_drip.get(account_id, 0)
        if now - last < COOLDOWN_SECONDS:
            remaining = int(COOLDOWN_SECONDS - (now - last))
            return False, f"Rate limited — wait {remaining}s (1 request per hour)"

        # Validate account ID format
        if not account_id.startswith("0.0."):
            return False, "Invalid account ID format (expected 0.0.XXXXX)"

        return True, ""

    def record_drip(self, account_id: str, amount: float, tx_id: str = ""):
        """Record a successful drip."""
        now = time.time()
        self.last_drip[account_id] = now
        self.total_distributed += amount
        self.daily_distributed += amount
        self.drip_history.append({
            "account_id": account_id,
            "amount": amount,
            "tx_id": tx_id,
            "timestamp": now,
        })
        # Keep only last 1000 entries
        if len(self.drip_history) > 1000:
            self.drip_history = self.drip_history[-500:]

    def init_hts(self):
        """Try to initialize HTS service for real token transfers."""
        try:
            from sdk.hedera.config import load_hedera_config
            from sdk.hedera.client import HederaClient
            from sdk.hedera.hts import HTSService

            config = load_hedera_config()
            client = HederaClient(config)
            self.hts_service = HTSService(client)
            logger.info("HTS service connected — real token transfers enabled")
            return True
        except Exception as e:
            logger.warning("HTS not available — running in dry-run mode: %s", e)
            return False


state = FaucetState()


# ---------------------------------------------------------------------------
# HTTP Handler
# ---------------------------------------------------------------------------

class FaucetHandler(BaseHTTPRequestHandler):
    """HTTP request handler for the faucet."""

    def log_message(self, format, *args):
        logger.info(format, *args)

    def do_GET(self):
        if self.path == "/health":
            self._respond(200, {"status": "ok", "service": "mdt-faucet"})

        elif self.path == "/status":
            self._respond(200, {
                "total_distributed": round(state.total_distributed, 2),
                "daily_distributed": round(state.daily_distributed, 2),
                "daily_budget": DAILY_BUDGET,
                "daily_remaining": round(DAILY_BUDGET - state.daily_distributed, 2),
                "unique_accounts": len(state.last_drip),
                "total_drips": len(state.drip_history),
                "max_drip": MAX_DRIP_AMOUNT,
                "default_drip": DEFAULT_DRIP,
                "cooldown_seconds": COOLDOWN_SECONDS,
                "hts_connected": state.hts_service is not None,
                "recent_drips": state.drip_history[-10:],
            })

        elif self.path == "/":
            # Simple HTML landing page
            html = f"""<!DOCTYPE html>
<html><head><title>MDT Testnet Faucet</title>
<style>
body {{ font-family: monospace; max-width: 600px; margin: 40px auto; padding: 20px;
       background: #0d1117; color: #c9d1d9; }}
h1 {{ color: #58a6ff; }}
.box {{ background: #161b22; border: 1px solid #30363d; padding: 20px;
        border-radius: 8px; margin: 20px 0; }}
code {{ color: #f0883e; }}
.btn {{ background: #238636; color: white; border: none; padding: 10px 20px;
        border-radius: 6px; cursor: pointer; font-size: 14px; }}
</style></head><body>
<h1>🚰 MDT Testnet Faucet</h1>
<div class="box">
<p>Get free testnet MDT tokens for the ModernTensor network.</p>
<p>Budget: <code>{DAILY_BUDGET - state.daily_distributed:.0f}</code> / {DAILY_BUDGET:.0f} MDT remaining today</p>
<p>Rate: 1 request per account per hour</p>
</div>
<div class="box">
<h3>API Usage:</h3>
<pre>
curl -X POST http://localhost:{FAUCET_PORT}/drip \\
  -H "Content-Type: application/json" \\
  -d '{{"account_id": "0.0.12345", "amount": 100}}'
</pre>
<h3>CLI Usage:</h3>
<pre>mtcli faucet --amount 100</pre>
</div>
<div class="box">
<p>Total distributed: <code>{state.total_distributed:.0f}</code> MDT to <code>{len(state.last_drip)}</code> accounts</p>
</div>
</body></html>"""
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(html.encode())

        else:
            self._respond(404, {"error": "Not found"})

    def do_POST(self):
        if self.path == "/drip":
            self._handle_drip()
        else:
            self._respond(404, {"error": "Not found"})

    def _handle_drip(self):
        """Process a faucet drip request."""
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length > 0 else {}
        except (json.JSONDecodeError, ValueError):
            self._respond(400, {"error": "Invalid JSON body"})
            return

        account_id = body.get("account_id", "")
        amount = body.get("amount", DEFAULT_DRIP)

        # Validate
        allowed, reason = state.can_drip(account_id, amount)
        if not allowed:
            self._respond(429, {"error": reason, "account_id": account_id})
            return

        # Try real transfer if HTS is available
        tx_id = ""
        if state.hts_service:
            try:
                state.hts_service.transfer_mdt(account_id, amount)
                tx_id = f"faucet-{int(time.time())}"
                logger.info("✅ Transferred %.1f MDT to %s", amount, account_id)
            except Exception as e:
                logger.error("Transfer failed: %s", e)
                self._respond(500, {"error": f"Transfer failed: {e}"})
                return
        else:
            tx_id = f"dry-run-{int(time.time())}"
            logger.info("🔹 [dry-run] %.1f MDT → %s", amount, account_id)

        # Record
        state.record_drip(account_id, amount, tx_id)

        self._respond(200, {
            "success": True,
            "account_id": account_id,
            "amount": amount,
            "tx_id": tx_id,
            "mode": "live" if state.hts_service else "dry-run",
            "message": f"Received {amount} MDT! Happy building ✨",
        })

    def _respond(self, status: int, data: dict):
        """Send JSON response."""
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode())

    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 60)
    print("  🚰 ModernTensor — Testnet MDT Faucet")
    print("=" * 60)
    print(f"  Port:          {FAUCET_PORT}")
    print(f"  Default drip:  {DEFAULT_DRIP} MDT")
    print(f"  Max drip:      {MAX_DRIP_AMOUNT} MDT")
    print(f"  Daily budget:  {DAILY_BUDGET} MDT")
    print(f"  Cooldown:      {COOLDOWN_SECONDS}s per account")

    # Try to connect to Hedera for real transfers
    has_hts = state.init_hts()
    mode = "LIVE (real token transfers)" if has_hts else "DRY-RUN (simulated)"
    print(f"  Mode:          {mode}")
    print("=" * 60)

    server = HTTPServer(("0.0.0.0", FAUCET_PORT), FaucetHandler)
    print(f"\n🟢 Faucet running at http://localhost:{FAUCET_PORT}")
    print(f"   Landing page: http://localhost:{FAUCET_PORT}/")
    print(f"   API status:   http://localhost:{FAUCET_PORT}/status")
    print("   Press Ctrl+C to stop\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🔴 Faucet stopped")
        print(f"   Total distributed: {state.total_distributed:.0f} MDT")
        server.server_close()


if __name__ == "__main__":
    main()
