"""
ModernTensor Subnet Manager

Manages subnet lifecycle — creation, configuration, metrics tracking.
Integrates with the SubnetRegistry smart contract via Hedera SDK.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from ..scoring.dimensions import DimensionConfig, CODE_REVIEW_DIMENSIONS, GENERAL_DIMENSIONS

logger = logging.getLogger(__name__)


@dataclass
class SubnetInfo:
    """Information about a registered subnet."""
    subnet_id: int
    name: str
    owner_id: str
    task_type: str
    fee_rate: float = 0.05
    min_stake: float = 100.0
    max_miners: int = 100
    is_active: bool = True
    scoring_dimensions: List[DimensionConfig] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    metadata: Dict[str, Any] = field(default_factory=dict)
    # Metrics
    total_tasks: int = 0
    total_volume: float = 0.0
    active_miners: int = 0
    avg_score: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "subnet_id": self.subnet_id,
            "name": self.name,
            "owner_id": self.owner_id,
            "task_type": self.task_type,
            "fee_rate": self.fee_rate,
            "min_stake": self.min_stake,
            "max_miners": self.max_miners,
            "is_active": self.is_active,
            "scoring_dimensions": [d.name for d in self.scoring_dimensions],
            "created_at": self.created_at,
            "total_tasks": self.total_tasks,
            "total_volume": round(self.total_volume, 4),
            "active_miners": self.active_miners,
            "avg_score": round(self.avg_score, 4),
        }


# Default subnets
DEFAULT_SUBNETS = [
    SubnetInfo(
        subnet_id=0,
        name="General AI",
        owner_id="protocol.treasury",
        task_type="general",
        fee_rate=0.05,
        scoring_dimensions=GENERAL_DIMENSIONS,
        metadata={"description": "General-purpose AI tasks"},
    ),
    SubnetInfo(
        subnet_id=1,
        name="AI Code Review",
        owner_id="protocol.treasury",
        task_type="code_review",
        fee_rate=0.03,
        scoring_dimensions=CODE_REVIEW_DIMENSIONS,
        metadata={"description": "Automated code review and security analysis"},
    ),
]


class SubnetManager:
    """
    Manages subnet registration and lifecycle.

    Subnets are specialized AI task networks within the marketplace.
    Each subnet has its own:
    - Scoring dimensions and weights
    - Fee rate
    - Minimum stake requirement
    - Registered miners

    Example:
        manager = SubnetManager()

        # Create a new subnet
        subnet = manager.create_subnet(
            name="NLP Generation",
            owner_id="0.0.5555",
            task_type="text_generation",
            fee_rate=0.04,
        )

        # Get subnet info
        info = manager.get_subnet(subnet.subnet_id)

        # List all subnets
        subnets = manager.list_subnets()
    """

    def __init__(self, load_defaults: bool = True):
        self._subnets: Dict[int, SubnetInfo] = {}
        self._next_id = 0

        if load_defaults:
            for subnet in DEFAULT_SUBNETS:
                self._subnets[subnet.subnet_id] = subnet
                self._next_id = max(self._next_id, subnet.subnet_id + 1)

        logger.info(
            "SubnetManager initialized with %d subnets", len(self._subnets)
        )

    def create_subnet(
        self,
        name: str,
        owner_id: str,
        task_type: str,
        fee_rate: float = 0.05,
        min_stake: float = 100.0,
        max_miners: int = 100,
        scoring_dimensions: Optional[List[DimensionConfig]] = None,
        metadata: Optional[Dict] = None,
    ) -> SubnetInfo:
        """
        Create a new subnet.

        Args:
            name: Human-readable subnet name
            owner_id: Hedera account ID of the owner
            task_type: Type of tasks this subnet handles
            fee_rate: Subnet fee rate (0 to 0.20)
            min_stake: Minimum stake for miners
            max_miners: Maximum miners allowed
            scoring_dimensions: Custom scoring dimensions
            metadata: Additional metadata

        Returns:
            Created SubnetInfo
        """
        if fee_rate < 0 or fee_rate > 0.20:
            raise ValueError(f"Fee rate must be 0-0.20, got {fee_rate}")

        subnet = SubnetInfo(
            subnet_id=self._next_id,
            name=name,
            owner_id=owner_id,
            task_type=task_type,
            fee_rate=fee_rate,
            min_stake=min_stake,
            max_miners=max_miners,
            scoring_dimensions=scoring_dimensions or GENERAL_DIMENSIONS,
            metadata=metadata or {},
        )

        self._subnets[subnet.subnet_id] = subnet
        self._next_id += 1

        logger.info(
            "Subnet created: id=%d, name=%s, type=%s, fee=%.1f%%",
            subnet.subnet_id,
            name,
            task_type,
            fee_rate * 100,
        )
        return subnet

    def get_subnet(self, subnet_id: int) -> Optional[SubnetInfo]:
        """Get subnet by ID."""
        return self._subnets.get(subnet_id)

    def list_subnets(self, active_only: bool = True) -> List[SubnetInfo]:
        """List all subnets."""
        subnets = list(self._subnets.values())
        if active_only:
            subnets = [s for s in subnets if s.is_active]
        return subnets

    def update_metrics(
        self,
        subnet_id: int,
        tasks_delta: int = 0,
        volume_delta: float = 0.0,
        miners_count: Optional[int] = None,
        new_score: Optional[float] = None,
    ) -> None:
        """Update subnet metrics after task completion."""
        subnet = self._subnets.get(subnet_id)
        if not subnet:
            return

        subnet.total_tasks += tasks_delta
        subnet.total_volume += volume_delta

        if miners_count is not None:
            subnet.active_miners = miners_count

        if new_score is not None and subnet.total_tasks > 0:
            # Running average
            alpha = 1.0 / subnet.total_tasks
            subnet.avg_score = (
                alpha * new_score + (1 - alpha) * subnet.avg_score
            )

    def deactivate_subnet(self, subnet_id: int) -> None:
        """Deactivate a subnet."""
        subnet = self._subnets.get(subnet_id)
        if subnet:
            subnet.is_active = False
            logger.info("Subnet %d deactivated", subnet_id)

    def get_fee_rate(self, subnet_id: int) -> float:
        """Get fee rate for a subnet. Returns default if not found."""
        subnet = self._subnets.get(subnet_id)
        return subnet.fee_rate if subnet else 0.05

    def get_stats(self) -> Dict[str, Any]:
        """Get aggregated subnet statistics."""
        subnets = list(self._subnets.values())
        return {
            "total_subnets": len(subnets),
            "active_subnets": sum(1 for s in subnets if s.is_active),
            "total_tasks": sum(s.total_tasks for s in subnets),
            "total_volume": round(sum(s.total_volume for s in subnets), 4),
            "total_miners": sum(s.active_miners for s in subnets),
            "subnets": [s.to_dict() for s in subnets],
        }
