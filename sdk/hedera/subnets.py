"""
ModernTensor - Subnet Service

SDK module for interacting with SubnetRegistry on Hedera.
Handles subnet creation, miner registration, and task management.
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
    PROTOCOL_FEE_RATE = 100  # 1%
    MAX_SUBNET_FEE_RATE = 2000  # 20%
    REGISTRATION_COST = 10000 * 10**8  # 10,000 MDT

    def __init__(self, contract_service, contract_id: str):
        """
        Initialize SubnetService.

        Args:
            contract_service: SmartContractService instance
            contract_id: SubnetRegistry contract ID
        """
        self.contract_service = contract_service
        self.contract_id = contract_id
        self._subnets_cache: dict[int, SubnetInfo] = {}

    # =========================================================================
    # SUBNET MANAGEMENT
    # =========================================================================

    async def register_subnet(
        self,
        config: SubnetConfig
    ) -> int:
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
        result = await self.contract_service.execute_contract(
            self.contract_id,
            "registerSubnet",
            [config.name, config.description, config.fee_rate]
        )

        # Extract subnet ID from event
        subnet_id = self._parse_subnet_created_event(result)
        return subnet_id

    async def get_subnet(self, subnet_id: int) -> SubnetInfo:
        """Get subnet information."""
        result = await self.contract_service.call_contract(
            self.contract_id,
            "getSubnet",
            [subnet_id]
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
            created_at=result[10]
        )

    async def get_subnet_count(self) -> int:
        """Get total number of subnets."""
        result = await self.contract_service.call_contract(
            self.contract_id,
            "subnetCount",
            []
        )
        return int(result)

    async def list_subnets(self) -> List[SubnetInfo]:
        """List all subnets."""
        count = await self.get_subnet_count()
        subnets = []

        for i in range(count):
            subnet = await self.get_subnet(i)
            subnets.append(subnet)

        return subnets

    async def update_subnet(
        self,
        subnet_id: int,
        new_fee_rate: int,
        new_status: SubnetStatus
    ) -> bool:
        """Update subnet configuration (owner only)."""
        await self.contract_service.execute_contract(
            self.contract_id,
            "updateSubnet",
            [subnet_id, new_fee_rate, new_status.value]
        )
        return True

    # =========================================================================
    # MINER REGISTRATION
    # =========================================================================

    async def register_miner(self, subnet_id: int) -> bool:
        """Register as miner in a subnet."""
        await self.contract_service.execute_contract(
            self.contract_id,
            "registerMiner",
            [subnet_id]
        )
        return True

    async def is_miner(self, subnet_id: int, address: str) -> bool:
        """Check if address is registered miner in subnet."""
        result = await self.contract_service.call_contract(
            self.contract_id,
            "isMiner",
            [subnet_id, address]
        )
        return bool(result)

    # =========================================================================
    # TASK MANAGEMENT
    # =========================================================================

    async def create_task(
        self,
        subnet_id: int,
        task_hash: str,
        reward_amount: int,
        duration_seconds: int
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
        result = await self.contract_service.execute_contract(
            self.contract_id,
            "createTask",
            [subnet_id, task_hash, reward_amount, duration_seconds]
        )

        task_id = self._parse_task_created_event(result)
        return task_id

    async def get_task(self, task_id: int) -> TaskInfo:
        """Get task information."""
        result = await self.contract_service.call_contract(
            self.contract_id,
            "getTask",
            [task_id]
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
            winning_miner=result[9] if result[9] != "0x0000000000000000000000000000000000000000" else None,
            winning_score=result[10],
            created_at=result[11]
        )

    async def submit_result(
        self,
        task_id: int,
        result_hash: str
    ) -> bool:
        """Submit result for a task."""
        await self.contract_service.execute_contract(
            self.contract_id,
            "submitResult",
            [task_id, result_hash]
        )
        return True

    async def finalize_task(self, task_id: int) -> bool:
        """Finalize task and trigger payment distribution."""
        await self.contract_service.execute_contract(
            self.contract_id,
            "finalizeTask",
            [task_id]
        )
        return True

    # =========================================================================
    # FEE CALCULATIONS
    # =========================================================================

    def calculate_fees(
        self,
        reward_amount: int,
        subnet_fee_rate: int
    ) -> dict:
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
            "total_deposit": total_deposit
        }

    # =========================================================================
    # INTERNAL HELPERS
    # =========================================================================

    def _parse_subnet_created_event(self, tx_result) -> int:
        """Parse SubnetCreated event to get subnet ID."""
        # Implementation depends on Hedera SDK event parsing
        # For now, return from logs
        return 0  # Placeholder

    def _parse_task_created_event(self, tx_result) -> int:
        """Parse TaskCreated event to get task ID."""
        return 0  # Placeholder


# Convenience factory
def create_subnet_service(contract_service, contract_id: str) -> SubnetService:
    """Create a SubnetService instance."""
    return SubnetService(contract_service, contract_id)
