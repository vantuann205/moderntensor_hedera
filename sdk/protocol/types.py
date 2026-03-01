"""
ModernTensor Protocol — Core Data Types

All data structures used throughout the marketplace protocol.
Uses dataclasses for clean serialization and immutability where appropriate.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class TaskStatus(str, Enum):
    """Lifecycle states for a task in the protocol."""
    PENDING = "pending"
    MATCHING = "matching"
    ASSIGNED = "assigned"
    EXECUTING = "executing"
    VALIDATING = "validating"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"
    DISPUTED = "disputed"


class TaskPriority(str, Enum):
    """Priority levels affecting matching and fees."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"

    @property
    def multiplier(self) -> float:
        """Fee multiplier for this priority level."""
        return {
            TaskPriority.LOW: 0.8,
            TaskPriority.NORMAL: 1.0,
            TaskPriority.HIGH: 1.5,
            TaskPriority.URGENT: 2.0,
        }[self]


class MinerStatus(str, Enum):
    """Registration status of a miner in the protocol."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    DEREGISTERED = "deregistered"


class ScoreDimension(str, Enum):
    """Standard scoring dimensions for AI task evaluation."""
    SECURITY = "security"
    CORRECTNESS = "correctness"
    READABILITY = "readability"
    BEST_PRACTICES = "best_practices"
    GAS_EFFICIENCY = "gas_efficiency"
    COMPLETENESS = "completeness"
    NOVELTY = "novelty"


# ---------------------------------------------------------------------------
# Task Types
# ---------------------------------------------------------------------------

@dataclass
class TaskRequest:
    """
    A task submitted by a user to the protocol.

    Attributes:
        task_id: Unique identifier (auto-generated if not provided)
        subnet_id: Which subnet to route this task to
        task_type: Type of task (e.g., "code_review", "text_generation")
        payload: The actual task data (code snippet, prompt, etc.)
        reward_amount: Total MDT reward offered for this task
        priority: Priority level affecting matching and fees
        max_miners: Maximum number of miners to assign
        timeout_seconds: Time limit for miners to complete
        requester_id: Account ID of the task submitter
        metadata: Additional task metadata
        created_at: Timestamp of creation
    """
    subnet_id: int
    task_type: str
    payload: Dict[str, Any]
    reward_amount: float
    requester_id: str
    task_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    priority: TaskPriority = TaskPriority.NORMAL
    max_miners: int = 3
    timeout_seconds: float = 300.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)
    status: TaskStatus = TaskStatus.PENDING

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "subnet_id": self.subnet_id,
            "task_type": self.task_type,
            "payload": self.payload,
            "reward_amount": self.reward_amount,
            "requester_id": self.requester_id,
            "priority": self.priority.value,
            "max_miners": self.max_miners,
            "timeout_seconds": self.timeout_seconds,
            "metadata": self.metadata,
            "created_at": self.created_at,
            "status": self.status.value,
        }


@dataclass
class TaskResult:
    """
    Result submitted by a miner for a task.

    Attributes:
        result_id: Unique identifier
        task_id: The task this result is for
        miner_id: The miner who produced this result
        output: The actual result data
        execution_time: How long the miner took (seconds)
        proof: Optional cryptographic proof of work
        metadata: Additional result metadata
        submitted_at: Timestamp of submission
    """
    task_id: str
    miner_id: str
    output: Dict[str, Any]
    result_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    execution_time: Optional[float] = None
    proof: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    submitted_at: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "result_id": self.result_id,
            "task_id": self.task_id,
            "miner_id": self.miner_id,
            "output": self.output,
            "execution_time": self.execution_time,
            "proof": self.proof,
            "metadata": self.metadata,
            "submitted_at": self.submitted_at,
        }


@dataclass
class TaskAssignment:
    """
    An assignment of a task to a specific miner.

    Tracks the assignment lifecycle from creation to completion.
    """
    task_id: str
    miner_id: str
    subnet_id: int
    assigned_at: float = field(default_factory=time.time)
    deadline: Optional[float] = None
    result: Optional[TaskResult] = None
    score: Optional[float] = None
    is_completed: bool = False
    is_timeout: bool = False
    commitment: Optional[str] = None  # For Commit-Reveal pattern

    @property
    def is_expired(self) -> bool:
        """Check if this assignment has exceeded its deadline."""
        if self.deadline is None:
            return False
        return time.time() > self.deadline

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "miner_id": self.miner_id,
            "subnet_id": self.subnet_id,
            "assigned_at": self.assigned_at,
            "deadline": self.deadline,
            "result": self.result.to_dict() if self.result else None,
            "score": self.score,
            "is_completed": self.is_completed,
            "is_timeout": self.is_timeout,
        }


# ---------------------------------------------------------------------------
# Miner Types
# ---------------------------------------------------------------------------

@dataclass
class MinerReputation:
    """
    Reputation tracking for a miner using Exponential Moving Average (EMA).

    EMA gives more weight to recent performance while preserving history.
    Formula: EMA_new = alpha * current_score + (1 - alpha) * EMA_old
    """
    score: float = 0.5
    total_tasks: int = 0
    successful_tasks: int = 0
    failed_tasks: int = 0
    timeout_tasks: int = 0
    average_response_time: float = 0.0
    ema_alpha: float = 0.1

    @property
    def success_rate(self) -> float:
        """Task completion success rate."""
        if self.total_tasks == 0:
            return 0.0
        return self.successful_tasks / self.total_tasks

    @property
    def timeout_rate(self) -> float:
        """Task timeout rate — high values indicate unreliable miner."""
        if self.total_tasks == 0:
            return 0.0
        return self.timeout_tasks / self.total_tasks

    def update(self, task_score: float, response_time: float, success: bool) -> None:
        """
        Update reputation after a task completion.

        Args:
            task_score: Score received for the task (0.0 to 1.0)
            response_time: Time taken to complete (seconds)
            success: Whether the task was completed successfully
        """
        self.total_tasks += 1

        if success:
            self.successful_tasks += 1
            # EMA update for reputation score
            self.score = (
                self.ema_alpha * task_score
                + (1 - self.ema_alpha) * self.score
            )
        else:
            self.failed_tasks += 1
            # Penalty for failures — larger drop
            self.score = (
                self.ema_alpha * (task_score * 0.5)
                + (1 - self.ema_alpha) * self.score
            )

        # EMA for response time
        self.average_response_time = (
            self.ema_alpha * response_time
            + (1 - self.ema_alpha) * self.average_response_time
        )

    def record_timeout(self) -> None:
        """Record a task timeout — heavier reputation penalty."""
        self.total_tasks += 1
        self.timeout_tasks += 1
        # Timeout is worse than failure
        self.score = max(0.0, self.score - 0.05)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "score": round(self.score, 4),
            "total_tasks": self.total_tasks,
            "successful_tasks": self.successful_tasks,
            "failed_tasks": self.failed_tasks,
            "timeout_tasks": self.timeout_tasks,
            "success_rate": round(self.success_rate, 4),
            "timeout_rate": round(self.timeout_rate, 4),
            "average_response_time": round(self.average_response_time, 2),
        }


@dataclass
class MinerInfo:
    """
    Complete information about a registered miner.

    Attributes:
        miner_id: Unique Hedera account ID
        subnet_ids: Subnets this miner is registered in
        stake_amount: Amount of MDT staked
        reputation: Reputation tracking object
        status: Current registration status
        capabilities: What task types this miner supports
        registered_at: When the miner first registered
        last_active_at: Last time the miner completed a task
    """
    miner_id: str
    subnet_ids: List[int] = field(default_factory=list)
    stake_amount: float = 0.0
    reputation: MinerReputation = field(default_factory=MinerReputation)
    status: MinerStatus = MinerStatus.ACTIVE
    capabilities: List[str] = field(default_factory=list)
    registered_at: float = field(default_factory=time.time)
    last_active_at: float = field(default_factory=time.time)
    metadata: Dict[str, Any] = field(default_factory=dict)

    # Networking: Axon endpoint for receiving tasks from validators
    axon_host: str = "0.0.0.0"
    axon_port: int = 0  # 0 = not serving

    @property
    def axon_endpoint(self) -> Optional[str]:
        """Full HTTP endpoint if axon is serving."""
        if self.axon_port > 0:
            return f"http://{self.axon_host}:{self.axon_port}"
        return None

    @property
    def is_active(self) -> bool:
        return self.status == MinerStatus.ACTIVE

    @property
    def effective_weight(self) -> float:
        """
        Merit-based weight: performance x reliability.
        Miners earn weight through quality of work, not stake.
        """
        performance = self.reputation.score ** 2
        reliability = self.reputation.success_rate
        return performance * max(0.01, reliability)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "miner_id": self.miner_id,
            "subnet_ids": self.subnet_ids,
            "stake_amount": self.stake_amount,
            "reputation": self.reputation.to_dict(),
            "status": self.status.value,
            "capabilities": self.capabilities,
            "registered_at": self.registered_at,
            "last_active_at": self.last_active_at,
            "effective_weight": round(self.effective_weight, 4),
            "axon_endpoint": self.axon_endpoint,
        }


# ---------------------------------------------------------------------------
# Scoring Types
# ---------------------------------------------------------------------------

@dataclass
class ScoreBreakdown:
    """
    Detailed scoring breakdown across multiple dimensions.

    Each dimension is scored 0.0–1.0, and the final score is a
    weighted combination.
    """
    dimensions: Dict[str, float] = field(default_factory=dict)
    weights: Dict[str, float] = field(default_factory=dict)
    final_score: float = 0.0
    confidence: float = 1.0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def compute_final(self) -> float:
        """Compute weighted final score from dimension scores."""
        if not self.dimensions or not self.weights:
            return 0.0

        total_weight = sum(
            self.weights.get(dim, 0.0) for dim in self.dimensions
        )
        if total_weight == 0:
            return 0.0

        weighted_sum = sum(
            score * self.weights.get(dim, 0.0)
            for dim, score in self.dimensions.items()
        )
        self.final_score = weighted_sum / total_weight
        return self.final_score

    def to_dict(self) -> Dict[str, Any]:
        return {
            "dimensions": {k: round(v, 4) for k, v in self.dimensions.items()},
            "weights": self.weights,
            "final_score": round(self.final_score, 4),
            "confidence": round(self.confidence, 4),
            "metadata": self.metadata,
        }


@dataclass
class ValidatorScore:
    """
    A score submitted by a validator for a specific task result.

    Validators independently score each miner's output, and these
    scores are then aggregated via consensus.
    """
    validator_id: str
    task_id: str
    miner_id: str
    breakdown: ScoreBreakdown
    timestamp: float = field(default_factory=time.time)
    signature: Optional[str] = None

    @property
    def final_score(self) -> float:
        return self.breakdown.final_score

    def to_dict(self) -> Dict[str, Any]:
        return {
            "validator_id": self.validator_id,
            "task_id": self.task_id,
            "miner_id": self.miner_id,
            "breakdown": self.breakdown.to_dict(),
            "final_score": round(self.final_score, 4),
            "timestamp": self.timestamp,
        }


# ---------------------------------------------------------------------------
# Fee & Payment Types
# ---------------------------------------------------------------------------

@dataclass
class FeeBreakdown:
    """
    Detailed fee calculation for a task.

    On-chain fee model (matches PaymentEscrow.sol):
        total_deposit = miner_reward + validator_reward + protocol_fee
        miner_reward   = 80% of base reward
        validator_reward = 15% of base reward
        protocol_fee   =  5% of base reward
    """
    reward_amount: float
    protocol_fee: float
    subnet_fee: float
    miner_reward: float
    protocol_fee_rate: float
    subnet_fee_rate: float
    validator_reward: float = 0.0  # 15% validator pool
    validator_reward_rate: float = 0.15
    subnet_owner_id: str = ""  # Hedera account ID of subnet owner

    @property
    def total_fee(self) -> float:
        return self.protocol_fee + self.subnet_fee + self.validator_reward

    @property
    def total_fee_rate(self) -> float:
        return self.protocol_fee_rate + self.subnet_fee_rate + self.validator_reward_rate

    @property
    def total_deposit(self) -> float:
        """Total amount deposited to escrow (reward + all fees)."""
        return self.miner_reward + self.validator_reward + self.protocol_fee + self.subnet_fee

    def to_dict(self) -> Dict[str, Any]:
        return {
            "reward_amount": round(self.reward_amount, 6),
            "protocol_fee": round(self.protocol_fee, 6),
            "subnet_fee": round(self.subnet_fee, 6),
            "validator_reward": round(self.validator_reward, 6),
            "miner_reward": round(self.miner_reward, 6),
            "total_fee": round(self.total_fee, 6),
            "total_deposit": round(self.total_deposit, 6),
            "protocol_fee_rate": self.protocol_fee_rate,
            "subnet_fee_rate": self.subnet_fee_rate,
            "validator_reward_rate": self.validator_reward_rate,
            "subnet_owner_id": self.subnet_owner_id,
            "total_fee_rate": round(self.total_fee_rate, 4),
        }


@dataclass
class PaymentInfo:
    """
    Payment record for a completed task.
    """
    payment_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str = ""
    miner_id: str = ""
    amount: float = 0.0
    fee_breakdown: Optional[FeeBreakdown] = None
    transaction_id: Optional[str] = None
    paid_at: Optional[float] = None
    is_paid: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "payment_id": self.payment_id,
            "task_id": self.task_id,
            "miner_id": self.miner_id,
            "amount": round(self.amount, 6),
            "fee_breakdown": self.fee_breakdown.to_dict() if self.fee_breakdown else None,
            "transaction_id": self.transaction_id,
            "paid_at": self.paid_at,
            "is_paid": self.is_paid,
        }


# ---------------------------------------------------------------------------
# Protocol Configuration
# ---------------------------------------------------------------------------

@dataclass
class ProtocolConfig:
    """
    Global protocol configuration.

    Fee split (matches on-chain PaymentEscrow.sol):
        - 80% → Miner reward
        - 15% → Validator reward pool
        -  5% → Protocol treasury
    """
    protocol_fee_rate: float = 0.05  # 5% of base reward → protocol treasury
    validator_reward_rate: float = 0.15  # 15% of base reward → validator pool
    min_subnet_fee_rate: float = 0.0
    max_subnet_fee_rate: float = 0.20  # Max 20%
    min_stake_amount: float = 100.0  # Minimum stake to be a miner
    max_miners_per_task: int = 10
    max_miners_per_subnet: int = 1000  # Max miners allowed in a single subnet
    default_task_timeout: float = 300.0  # 5 minutes
    min_validators_for_consensus: int = 2
    reputation_ema_alpha: float = 0.1
    miner_suspension_threshold: float = 0.15  # Suspend if reputation < 15%
    network: str = "testnet"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "protocol_fee_rate": self.protocol_fee_rate,
            "validator_reward_rate": self.validator_reward_rate,
            "min_subnet_fee_rate": self.min_subnet_fee_rate,
            "max_subnet_fee_rate": self.max_subnet_fee_rate,
            "min_stake_amount": self.min_stake_amount,
            "max_miners_per_task": self.max_miners_per_task,
            "default_task_timeout": self.default_task_timeout,
            "min_validators_for_consensus": self.min_validators_for_consensus,
            "reputation_ema_alpha": self.reputation_ema_alpha,
            "miner_suspension_threshold": self.miner_suspension_threshold,
            "network": self.network,
        }
