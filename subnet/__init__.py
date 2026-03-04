"""
ModernTensor Subnet Package

A self-contained subnet that miners and validators can join on-chain.

Usage:
    # Register subnet, start miners + validator, run demo
    python run_subnet_demo.py

    # Or run individual components:
    python -m subnet.miner_node --port 9001 --skill 0.95 --name Alpha
    python -m subnet.validator_node

For ModernTensor on Hedera — Hello Future Hackathon 2026
"""

from .config import SubnetConfig
from .miner_node import SubnetMiner
from .validator_node import SubnetValidator

__all__ = ["SubnetConfig", "SubnetMiner", "SubnetValidator"]
