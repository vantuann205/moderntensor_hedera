"""
HCS Service Module - Hedera Consensus Service

High-level service for HCS operations.
Uses HederaClient which returns SDK types directly.

For ModernTensor on Hedera - Hello Future Hackathon 2026
"""

import json
import logging
import base64
from typing import Optional, List, Dict, Any, TYPE_CHECKING
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

import httpx

if TYPE_CHECKING:
    from .client import HederaClient

logger = logging.getLogger(__name__)


class HCSMessageType(str, Enum):
    """Types of HCS messages for ModernTensor protocol."""
    MINER_REGISTER = "miner_register"
    MINER_HEARTBEAT = "miner_heartbeat"
    SCORE_SUBMIT = "score_submit"
    TASK_CREATE = "task_create"
    TASK_COMPLETE = "task_complete"


# These dataclasses are for ModernTensor protocol messages, not SDK wrappers
@dataclass
class MinerRegistration:
    """Miner registration data for HCS message."""
    miner_id: str
    account_id: str
    capabilities: List[str] = field(default_factory=list)
    stake_amount: int = 0
    subnet_ids: List[int] = field(default_factory=lambda: [0])

    def to_json(self) -> str:
        return json.dumps({
            "type": HCSMessageType.MINER_REGISTER.value,
            "miner_id": self.miner_id,
            "account_id": self.account_id,
            "capabilities": self.capabilities,
            "stake_amount": self.stake_amount,
            "subnet_ids": self.subnet_ids,
            "timestamp": datetime.utcnow().isoformat(),
        })


@dataclass
class ScoreSubmission:
    """Validator score submission for HCS message."""
    validator_id: str
    miner_id: str
    task_id: str
    score: float  # 0-100
    confidence: float = 1.0
    metrics: Dict[str, float] = field(default_factory=dict)

    def to_json(self) -> str:
        return json.dumps({
            "type": HCSMessageType.SCORE_SUBMIT.value,
            "validator_id": self.validator_id,
            "miner_id": self.miner_id,
            "task_id": self.task_id,
            "score": self.score,
            "confidence": self.confidence,
            "metrics": self.metrics,
            "timestamp": datetime.utcnow().isoformat(),
        })


@dataclass
class TaskSubmission:
    """Task creation for HCS message."""
    task_id: str
    requester_id: str
    task_type: str
    prompt: str
    reward_amount: int
    deadline: int

    def to_json(self) -> str:
        return json.dumps({
            "type": HCSMessageType.TASK_CREATE.value,
            "task_id": self.task_id,
            "requester_id": self.requester_id,
            "task_type": self.task_type,
            "prompt": self.prompt,
            "reward_amount": self.reward_amount,
            "deadline": self.deadline,
            "timestamp": datetime.utcnow().isoformat(),
        })


class HCSService:
    """
    HCS service for ModernTensor protocol.

    All transaction methods return SDK TransactionReceipt directly.

    Usage:
        from sdk.hedera import HederaClient
        from sdk.hedera.hcs import HCSService, MinerRegistration

        client = HederaClient.from_env()
        hcs = HCSService(client)

        # Create topic - returns topic ID string
        topic_id = hcs.create_registration_topic()

        # Register miner - returns SDK TransactionReceipt
        receipt = hcs.register_miner(MinerRegistration(
            miner_id="miner-001",
            account_id="0.0.12345",
            capabilities=["text_generation"],
        ))
        print(f"Sequence: {receipt.topic_sequence_number}")
    """

    def __init__(self, client: "HederaClient"):
        self.client = client
        self.config = client.config

    @property
    def registration_topic_id(self) -> Optional[str]:
        return self.config.hcs_topics.registration_topic_id

    @property
    def scoring_topic_id(self) -> Optional[str]:
        return self.config.hcs_topics.scoring_topic_id

    @property
    def task_topic_id(self) -> Optional[str]:
        return self.config.hcs_topics.task_topic_id

    # =========================================================================
    # Topic Creation - Returns topic ID string
    # =========================================================================

    def create_registration_topic(self, memo: str = "ModernTensor Miner Registration", permissioned: bool = True) -> str:
        """
        Create registration topic. Returns topic ID.

        Args:
            permissioned: If True, creates a private-write topic (only admin can write).
                          If False, creates a public topic (anyone can write - SPAM RISK).
        """
        # For Hackathon: Use Permissioned=True to prevent spam during demo
        topic_id = self.client.create_topic(memo=memo, admin_key=True, submit_key=permissioned)
        self.config.hcs_topics.registration_topic_id = topic_id
        return topic_id

    def create_scoring_topic(self, memo: str = "ModernTensor Validator Scoring") -> str:
        """Create scoring topic. Returns topic ID."""
        topic_id = self.client.create_topic(memo=memo, admin_key=True, submit_key=True)
        self.config.hcs_topics.scoring_topic_id = topic_id
        return topic_id

    def create_task_topic(self, memo: str = "ModernTensor Task Queue") -> str:
        """Create task topic. Returns topic ID."""
        topic_id = self.client.create_topic(memo=memo, admin_key=True)
        self.config.hcs_topics.task_topic_id = topic_id
        return topic_id

    # =========================================================================
    # Message Publishing - Returns SDK TransactionReceipt
    # =========================================================================

    def register_miner(self, registration: MinerRegistration):
        """
        Register a miner via HCS.

        Returns:
            SDK TransactionReceipt (has topic_sequence_number)
        """
        if not self.registration_topic_id:
            raise ValueError("Registration topic not set. Call create_registration_topic() first.")

        return self.client.submit_message(self.registration_topic_id, registration.to_json())

    def submit_score(self, score: ScoreSubmission):
        """
        Submit a validation score via HCS.

        Returns:
            SDK TransactionReceipt
        """
        if not self.scoring_topic_id:
            raise ValueError("Scoring topic not set. Call create_scoring_topic() first.")

        return self.client.submit_message(self.scoring_topic_id, score.to_json())

    def create_task(self, task: TaskSubmission):
        """
        Create a task via HCS.

        Returns:
            SDK TransactionReceipt
        """
        if not self.task_topic_id:
            raise ValueError("Task topic not set. Call create_task_topic() first.")

        return self.client.submit_message(self.task_topic_id, task.to_json())

    def send_heartbeat(self, miner_id: str, account_id: str):
        """
        Send miner heartbeat.

        Returns:
            SDK TransactionReceipt
        """
        if not self.registration_topic_id:
            raise ValueError("Registration topic not set.")

        msg = json.dumps({
            "type": HCSMessageType.MINER_HEARTBEAT.value,
            "miner_id": miner_id,
            "account_id": account_id,
            "timestamp": datetime.utcnow().isoformat(),
        })

        return self.client.submit_message(self.registration_topic_id, msg)

    # =========================================================================
    # Message Retrieval (Mirror Node API)
    # =========================================================================

    def get_messages(self, topic_id: str, limit: int = 100, after_sequence: int = 0) -> List[Dict]:
        """
        Get messages from topic via Mirror Node API.

        Returns:
            List of parsed message dicts
        """
        network = self.config.network.value
        base_urls = {
            "mainnet": "https://mainnet-public.mirrornode.hedera.com",
            "testnet": "https://testnet.mirrornode.hedera.com",
            "previewnet": "https://previewnet.mirrornode.hedera.com",
        }
        base_url = base_urls.get(network, base_urls["testnet"])

        url = f"{base_url}/api/v1/topics/{topic_id}/messages"
        params = {"limit": limit}
        if after_sequence > 0:
            params["sequencenumber"] = f"gt:{after_sequence}"

        try:
            response = httpx.get(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()

            messages = []
            for msg_data in data.get("messages", []):
                try:
                    content = base64.b64decode(msg_data["message"]).decode('utf-8')
                    payload = json.loads(content)
                    messages.append({
                        "sequence_number": msg_data.get("sequence_number"),
                        "consensus_timestamp": msg_data.get("consensus_timestamp"),
                        "payer_account_id": msg_data.get("payer_account_id"),
                        **payload,
                    })
                except (json.JSONDecodeError, ValueError):
                    continue

            return messages
        except httpx.HTTPError as e:
            logger.error(f"Mirror node request failed: {e}")
            return []

    def get_registrations(self, limit: int = 100) -> List[Dict]:
        """Get miner registrations from topic."""
        if not self.registration_topic_id:
            return []

        messages = self.get_messages(self.registration_topic_id, limit)
        return [m for m in messages if m.get("type") == HCSMessageType.MINER_REGISTER.value]

    def get_scores(self, limit: int = 100) -> List[Dict]:
        """Get score submissions from topic."""
        if not self.scoring_topic_id:
            return []

        messages = self.get_messages(self.scoring_topic_id, limit)
        return [m for m in messages if m.get("type") == HCSMessageType.SCORE_SUBMIT.value]

    def get_tasks(self, limit: int = 100) -> List[Dict]:
        """Get tasks from topic."""
        if not self.task_topic_id:
            return []

        messages = self.get_messages(self.task_topic_id, limit)
        return [m for m in messages if m.get("type") == HCSMessageType.TASK_CREATE.value]
