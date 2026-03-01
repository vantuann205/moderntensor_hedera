"""
ModernTensor Staking Emissions Schedule

Manages epoch-based MDT staking reward emissions with halving.

Emission Schedule:
    Year 1-2: 25M MDT/year (68,493 MDT/day)
    Year 3-4: 12.5M MDT/year (halving)
    Year 5+:  Community governed (DAO vote)
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

MDT_DECIMALS = 8


@dataclass
class EmissionEpoch:
    """Represents one epoch of staking rewards."""
    epoch_number: int = 0
    start_time: float = 0.0
    end_time: float = 0.0
    total_emission: float = 0.0
    distributed: float = 0.0
    is_finalized: bool = False
    distributions: Dict[str, float] = field(default_factory=dict)

    @property
    def remaining(self) -> float:
        return max(0, self.total_emission - self.distributed)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "epoch_number": self.epoch_number,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "total_emission": self.total_emission,
            "distributed": self.distributed,
            "is_finalized": self.is_finalized,
            "distributions": self.distributions,
        }


class EmissionSchedule:
    """
    Manages MDT emission schedule for staking rewards.

    Follows Bitcoin-style halving:
    - Total pool: 100M MDT
    - Year 1-2: 25M/year
    - Year 3-4: 12.5M/year (first halving)
    - Year 5+: DAO governed
    """

    TOTAL_EMISSION_POOL = 100_000_000
    SECONDS_PER_DAY = 86400
    EPOCH_DURATION = SECONDS_PER_DAY

    HALVING_SCHEDULE = [
        (1, 2, 25_000_000),
        (3, 4, 12_500_000),
        (5, 6, 6_250_000),
        (7, 8, 3_125_000),
    ]

    def __init__(self, start_timestamp: Optional[float] = None):
        self.start_timestamp = start_timestamp or time.time()
        self._epochs: Dict[int, EmissionEpoch] = {}
        self._total_distributed = 0.0

        self.data_dir = Path("data")
        self.data_dir.mkdir(exist_ok=True)
        self.state_file = self.data_dir / "emissions.json"
        self._load_state()

        logger.info("EmissionSchedule initialized - pool=%.0f MDT", self.TOTAL_EMISSION_POOL)

    def get_current_epoch_number(self) -> int:
        elapsed = time.time() - self.start_timestamp
        return max(0, int(elapsed / self.EPOCH_DURATION))

    def get_current_year(self) -> int:
        elapsed = time.time() - self.start_timestamp
        return max(1, int(elapsed / (365 * self.SECONDS_PER_DAY)) + 1)

    def get_daily_emission(self, year: Optional[int] = None) -> float:
        if year is None:
            year = self.get_current_year()
        for start, end, annual in self.HALVING_SCHEDULE:
            if start <= year <= end:
                return annual / 365.0
        return 1_000_000 / 365.0

    def get_current_epoch(self) -> EmissionEpoch:
        epoch_num = self.get_current_epoch_number()
        if epoch_num not in self._epochs:
            start = self.start_timestamp + epoch_num * self.EPOCH_DURATION
            self._epochs[epoch_num] = EmissionEpoch(
                epoch_number=epoch_num,
                start_time=start,
                end_time=start + self.EPOCH_DURATION,
                total_emission=self.get_daily_emission(),
            )
        return self._epochs[epoch_num]

    def calculate_epoch_rewards(self, stakers: Dict[str, float]) -> Dict[str, float]:
        """Calculate rewards proportional to stake amount."""
        if not stakers:
            return {}
        epoch = self.get_current_epoch()
        if epoch.is_finalized:
            return epoch.distributions
        daily = epoch.total_emission
        total_stake = sum(stakers.values())
        if total_stake == 0:
            return {}
        rewards = {}
        for staker_id, stake in stakers.items():
            share = (stake / total_stake) * daily
            rewards[staker_id] = round(share, MDT_DECIMALS)
        return rewards

    def distribute_epoch(self, rewards: Dict[str, float]) -> EmissionEpoch:
        """Finalize epoch and record distributions."""
        epoch = self.get_current_epoch()
        if epoch.is_finalized:
            return epoch
        epoch.distributions = rewards
        epoch.distributed = sum(rewards.values())
        epoch.is_finalized = True
        self._total_distributed += epoch.distributed
        self._save_state()
        logger.info("Epoch %d: distributed %.2f MDT to %d stakers",
                     epoch.epoch_number, epoch.distributed, len(rewards))
        return epoch

    def get_total_distributed(self) -> float:
        return self._total_distributed

    def get_remaining_pool(self) -> float:
        return max(0, self.TOTAL_EMISSION_POOL - self._total_distributed)

    def get_stats(self) -> Dict[str, Any]:
        return {
            "current_epoch": self.get_current_epoch_number(),
            "current_year": self.get_current_year(),
            "daily_emission": round(self.get_daily_emission(), 4),
            "total_distributed": round(self._total_distributed, 4),
            "remaining_pool": round(self.get_remaining_pool(), 4),
            "total_epochs_finalized": sum(1 for e in self._epochs.values() if e.is_finalized),
        }

    def _save_state(self) -> None:
        try:
            data = {
                "start_timestamp": self.start_timestamp,
                "total_distributed": self._total_distributed,
                "epochs": {
                    str(k): v.to_dict()
                    for k, v in self._epochs.items()
                    if v.is_finalized
                },
            }
            with open(self.state_file, "w") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error("Failed to save emission state: %s", e)

    def _load_state(self) -> None:
        if not self.state_file.exists():
            return
        try:
            with open(self.state_file, "r") as f:
                data = json.load(f)
            self.start_timestamp = data.get("start_timestamp", self.start_timestamp)
            self._total_distributed = data.get("total_distributed", 0.0)
            for k, v in data.get("epochs", {}).items():
                epoch = EmissionEpoch(**v)
                self._epochs[int(k)] = epoch
        except Exception as e:
            logger.error("Failed to load emission state: %s", e)
