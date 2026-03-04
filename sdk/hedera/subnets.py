"""
ModernTensor - Subnet Service

SDK module for interacting with SubnetRegistry on Hedera.
Handles subnet creation, miner registration, and task management.

NOTE: All methods are synchronous — they call HederaClient.execute_contract /
      call_contract which are themselves synchronous (blocking).
"""

from dataclasses import dataclass
from typing import Optional, List
from enum import IntEnum


class SubnetStatus(IntEnum):
    """Subnet statuses"""

    ACTIVE = 0
    PAUSED = 1
    DEPRECATED = 2


class TaskStatus(IntEnum):
    """Task statuses"""

    CREATED = 0
    IN_PROGRESS = 1
    PENDING_REVIEW = 2
    COMPLETED = 3
    CANCELLED = 4
    EXPIRED = 5


@dataclass
class SubnetInfo:
    """Subnet information from contract"""

    id: int
    name: str
    description: str
    owner: str
    fee_rate: int  # basis points
    min_task_reward: int
    total_volume: int
    total_tasks: int
    active_miners: int
    status: SubnetStatus
    created_at: int


@dataclass
class TaskInfo:
    """Task information from contract"""

    id: int
    subnet_id: int
    requester: str
    task_hash: str
    reward_amount: int
    protocol_fee: int
    subnet_fee: int
    deadline: int
    status: TaskStatus
    winning_miner: Optional[str]
    winning_score: int
    created_at: int


@dataclass
class SubnetConfig:
    """Configuration for a subnet"""

    name: str
    description: str
    fee_rate: int = 500  # 5% default
    min_task_reward: int = 100000000  # 1 MDT


class SubnetService:
    """
    Service for interacting with SubnetRegistry contract.

    Features:
    - Register new subnets
    - Create tasks in specific subnets
    - Register as miner in subnet
    - Query subnet and task information
    """

    # Protocol constants
    PROTOCOL_FEE_RATE = 500  # 5% (matches PaymentEscrow.sol platformFeeRate)
    MAX_SUBNET_FEE_RATE = 2000  # 20%
    REGISTRATION_COST = 10000 * 10**8  # 10,000 MDT

    def __init__(self, contract_service, contract_id: str):
        """
        Initialize SubnetService.

        Args:
            contract_service: HederaClient (or compatible) instance
            contract_id: SubnetRegistry contract ID
        """
        self.contract_service = contract_service
        self.contract_id = contract_id
        self._subnets_cache: dict[int, SubnetInfo] = {}

    # =========================================================================
    # SUBNET MANAGEMENT
    # =========================================================================

    def register_subnet(self, config: SubnetConfig) -> int:
        """
        Register a new subnet.

        Args:
            config: Subnet configuration

        Returns:
            Subnet ID
        """
        if config.fee_rate > self.MAX_SUBNET_FEE_RATE:
            raise ValueError(f"Fee rate exceeds max: {self.MAX_SUBNET_FEE_RATE}")

        # Call contract
        result = self.contract_service.execute_contract(
            self.contract_id,
            "registerSubnet",
            [config.name, config.description, config.fee_rate],
        )

        # Extract subnet ID from event
        subnet_id = self._parse_subnet_created_event(result)
        return subnet_id

    def get_subnet(self, subnet_id: int) -> SubnetInfo:
        """Get subnet information."""
        result = self.contract_service.call_contract(
            self.contract_id, "getSubnet", [subnet_id]
        )

        return SubnetInfo(
            id=result[0],
            name=result[1],
            description=result[2],
            owner=result[3],
            fee_rate=result[4],
            min_task_reward=result[5],
            total_volume=result[6],
            total_tasks=result[7],
            active_miners=result[8],
            status=SubnetStatus(result[9]),
            created_at=result[10],
        )

    def get_subnet_count(self) -> int:
        """Get total number of subnets."""
        result = self.contract_service.call_contract(
            self.contract_id, "subnetCount", []
        )
        return int(result)

    def list_subnets(self) -> List[SubnetInfo]:
        """List all subnets."""
        count = self.get_subnet_count()
        subnets = []

        for i in range(count):
            subnet = self.get_subnet(i)
            subnets.append(subnet)

        return subnets

    def update_subnet(
        self, subnet_id: int, new_fee_rate: int, new_status: SubnetStatus
    ) -> bool:
        """Update subnet configuration (owner only)."""
        self.contract_service.execute_contract(
            self.contract_id,
            "updateSubnet",
            [subnet_id, new_fee_rate, new_status.value],
        )
        return True

    # =========================================================================
    # MINER REGISTRATION
    # =========================================================================

    def register_miner(self, subnet_id: int) -> bool:
        """Register as miner in a subnet."""
        self.contract_service.execute_contract(
            self.contract_id, "registerMiner", [subnet_id]
        )
        return True

    def is_miner(self, subnet_id: int, address: str) -> bool:
        """Check if address is registered miner in subnet."""
        result = self.contract_service.call_contract(
            self.contract_id, "isMiner", [subnet_id, address]
        )
        return bool(result)

    # =========================================================================
    # TASK MANAGEMENT
    # =========================================================================

    def create_task(
        self, subnet_id: int, task_hash: str, reward_amount: int, duration_seconds: int
    ) -> int:
        """
        Create a task in a specific subnet.

        Args:
            subnet_id: Target subnet
            task_hash: IPFS/HCS hash of task data
            reward_amount: MDT reward for miner
            duration_seconds: Task deadline in seconds

        Returns:
            Task ID
        """
        result = self.contract_service.execute_contract(
            self.contract_id,
            "createTask",
            [subnet_id, task_hash, reward_amount, duration_seconds],
        )

        task_id = self._parse_task_created_event(result)
        return task_id

    def get_task(self, task_id: int) -> TaskInfo:
        """Get task information."""
        result = self.contract_service.call_contract(
            self.contract_id, "getTask", [task_id]
        )

        return TaskInfo(
            id=result[0],
            subnet_id=result[1],
            requester=result[2],
            task_hash=result[3],
            reward_amount=result[4],
            protocol_fee=result[5],
            subnet_fee=result[6],
            deadline=result[7],
            status=TaskStatus(result[8]),
            winning_miner=(
                result[9]
                if result[9] != "0x0000000000000000000000000000000000000000"
                else None
            ),
            winning_score=result[10],
            created_at=result[11],
        )

    def submit_result(self, task_id: int, result_hash: str) -> bool:
        """Submit result for a task."""
        self.contract_service.execute_contract(
            self.contract_id, "submitResult", [task_id, result_hash]
        )
        return True

    def finalize_task(self, task_id: int) -> bool:
        """Finalize task and trigger payment distribution."""
        self.contract_service.execute_contract(
            self.contract_id, "finalizeTask", [task_id]
        )
        return True

    # =========================================================================
    # FEE CALCULATIONS
    # =========================================================================

    def calculate_fees(self, reward_amount: int, subnet_fee_rate: int) -> dict:
        """
        Calculate fee breakdown for a task.

        Returns:
            dict with protocol_fee, subnet_fee, miner_reward, total_deposit
        """
        protocol_fee = (reward_amount * self.PROTOCOL_FEE_RATE) // 10000
        subnet_fee = (reward_amount * subnet_fee_rate) // 10000
        miner_reward = reward_amount
        total_deposit = reward_amount + protocol_fee + subnet_fee

        return {
            "protocol_fee": protocol_fee,
            "subnet_fee": subnet_fee,
            "miner_reward": miner_reward,
            "total_deposit": total_deposit,
        }

    # =========================================================================
    # PULL PATTERN: WITHDRAWALS
    # =========================================================================

    def withdraw_earnings(self) -> bool:
        """Withdraw pending earnings (miner/validator Pull pattern)."""
        self.contract_service.execute_contract(self.contract_id, "withdrawEarnings", [])
        return True

    def get_pending_withdrawals(self, address: str) -> int:
        """Get pending withdrawable balance for an address."""
        result = self.contract_service.call_contract(
            self.contract_id, "pendingWithdrawals", [address]
        )
        return result

    # =========================================================================
    # COMMIT-REVEAL SCHEME
    # =========================================================================

    def commit_score(self, task_id: int, miner_index: int, commit_hash: bytes) -> bool:
        """
        Phase A: Commit a hashed score (anti-front-running).

        Args:
            task_id: Task ID
            miner_index: Index of miner submission
            commit_hash: keccak256(abi.encodePacked(score, salt))
        """
        self.contract_service.execute_contract(
            self.contract_id, "commitScore", [task_id, miner_index, commit_hash]
        )
        return True

    def reveal_score(
        self, task_id: int, miner_index: int, score: int, salt: bytes
    ) -> bool:
        """
        Phase B: Reveal the committed score.

        Args:
            task_id: Task ID
            miner_index: Index of miner submission
            score: The actual validation score (0-10000)
            salt: The random salt used when committing
        """
        self.contract_service.execute_contract(
            self.contract_id, "revealScore", [task_id, miner_index, score, salt]
        )
        return True

    def get_commit_hash(self, score: int, salt: bytes) -> bytes:
        """Generate commit hash for off-chain verification."""
        result = self.contract_service.call_contract(
            self.contract_id, "getCommitHash", [score, salt]
        )
        return result

    # =========================================================================
    # PROOF-OF-INTELLIGENCE: REPUTATION
    # =========================================================================

    def get_validator_reputation(self, address: str) -> dict:
        """
        Get on-chain reputation data for a validator.

        Returns:
            dict with totalValidations, accurateValidations,
            reputationScore (basis points), lastActiveAt
        """
        result = self.contract_service.call_contract(
            self.contract_id, "validatorReputation", [address]
        )
        return {
            "total_validations": result[0],
            "accurate_validations": result[1],
            "reputation_score": result[2],
            "last_active_at": result[3],
            "reputation_percent": result[2] / 100,  # Convert basis points to %
        }

    def port_reputation(self, from_subnet_id: int, to_subnet_id: int) -> bool:
        """
        Port reputation from one subnet to another (50% decay).

        Cross-Subnet Reputation Portability — unique to ModernTensor.
        Validators who proved themselves in one AI domain can carry
        50% of their reputation to a new domain.
        """
        self.contract_service.execute_contract(
            self.contract_id, "portReputation", [from_subnet_id, to_subnet_id]
        )
        return True

    # =========================================================================
    # PROOF-OF-INTELLIGENCE: ADAPTIVE VALIDATION
    # =========================================================================

    def get_adaptive_min_validations(self, subnet_id: int, reward_amount: int) -> int:
        """
        Get adaptive minValidations based on task reward.

        Higher-value tasks require more validators (security scales with value).
        """
        result = self.contract_service.call_contract(
            self.contract_id, "getAdaptiveMinValidations", [subnet_id, reward_amount]
        )
        return result

    # =========================================================================
    # INTERNAL HELPERS
    # =========================================================================

    def _parse_subnet_created_event(self, tx_result) -> int:
        """Parse SubnetCreated event to get subnet ID.

        The TransactionReceipt from Hedera contains a ContractFunctionResult
        which logs the event: SubnetCreated(uint256 indexed subnetId, ...).
        We read the first uint256 from the receipt's contract_function_result.
        """
        try:
            if hasattr(tx_result, "contract_function_result"):
                fn_result = tx_result.contract_function_result
                if fn_result and hasattr(fn_result, "get_uint256"):
                    return fn_result.get_uint256(0)
            # Fallback: return current subnetCount (the id just assigned)
            count_result = self.contract_service.call_contract(
                self.contract_id, "subnetCount", []
            )
            if hasattr(count_result, "get_uint256"):
                return count_result.get_uint256(0)
            return int(count_result)
        except Exception:
            return 0

    def _parse_task_created_event(self, tx_result) -> int:
        """Parse TaskCreated event to get task ID.

        Reads the first uint256 from the receipt's contract_function_result,
        which corresponds to the emitted taskId.
        """
        try:
            if hasattr(tx_result, "contract_function_result"):
                fn_result = tx_result.contract_function_result
                if fn_result and hasattr(fn_result, "get_uint256"):
                    return fn_result.get_uint256(0)
            return 0
        except Exception:
            return 0


# Convenience factory
def create_subnet_service(contract_service, contract_id: str) -> SubnetService:
    """Create a SubnetService instance."""
    return SubnetService(contract_service, contract_id)
