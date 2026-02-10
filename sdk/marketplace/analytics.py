"""
ModernTensor Protocol Analytics

Aggregates metrics from all protocol components into a unified
analytics view. Provides real-time and historical protocol statistics.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class EpochSnapshot:
    """Snapshot of protocol state at a specific epoch."""
    epoch: int
    timestamp: float
    total_tasks: int
    completed_tasks: int
    total_volume: float
    active_miners: int
    active_subnets: int
    avg_score: float
    protocol_revenue: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "epoch": self.epoch,
            "timestamp": self.timestamp,
            "total_tasks": self.total_tasks,
            "completed_tasks": self.completed_tasks,
            "total_volume": round(self.total_volume, 4),
            "active_miners": self.active_miners,
            "active_subnets": self.active_subnets,
            "avg_score": round(self.avg_score, 4),
            "protocol_revenue": round(self.protocol_revenue, 4),
        }


class ProtocolAnalytics:
    """
    Protocol-wide analytics aggregation.

    Tracks:
    - Task throughput and completion rates
    - Volume and revenue metrics
    - Network health indicators
    - Epoch-over-epoch comparisons
    - Top-performing miners and subnets

    Example:
        analytics = ProtocolAnalytics()

        # Record events
        analytics.record_task_completed(
            subnet_id=1,
            reward=50.0,
            score=0.85,
            completion_time=12.5,
        )

        # Get dashboard metrics
        metrics = analytics.get_dashboard_metrics()
    """

    def __init__(self):
        self._tasks_submitted = 0
        self._tasks_completed = 0
        self._tasks_failed = 0
        self._total_volume = 0.0
        self._total_revenue = 0.0
        self._started_at = time.time()
        self._epoch_snapshots: List[EpochSnapshot] = []
        self._subnet_metrics: Dict[int, Dict[str, Any]] = {}
        self._completion_times: List[float] = []
        self._scores: List[float] = []
        self._hourly_volume: Dict[int, float] = {}
        logger.info("ProtocolAnalytics initialized")

    def record_task_submitted(self, subnet_id: int, reward: float) -> None:
        """Record a new task submission."""
        self._tasks_submitted += 1
        self._total_volume += reward
        self._record_hourly_volume(reward)
        self._init_subnet(subnet_id)
        self._subnet_metrics[subnet_id]["tasks_submitted"] += 1
        self._subnet_metrics[subnet_id]["volume"] += reward

    def record_task_completed(
        self,
        subnet_id: int,
        reward: float,
        score: float,
        completion_time: float,
        protocol_fee: float = 0.0,
    ) -> None:
        """Record a completed task."""
        self._tasks_completed += 1
        self._total_revenue += protocol_fee
        self._completion_times.append(completion_time)
        self._scores.append(score)

        self._init_subnet(subnet_id)
        self._subnet_metrics[subnet_id]["tasks_completed"] += 1
        self._subnet_metrics[subnet_id]["avg_score"] = self._running_avg(
            self._subnet_metrics[subnet_id]["avg_score"],
            score,
            self._subnet_metrics[subnet_id]["tasks_completed"],
        )

        # Keep bounded
        if len(self._completion_times) > 1000:
            self._completion_times = self._completion_times[-500:]
        if len(self._scores) > 1000:
            self._scores = self._scores[-500:]

    def record_task_failed(self, subnet_id: int) -> None:
        """Record a failed task."""
        self._tasks_failed += 1
        self._init_subnet(subnet_id)
        self._subnet_metrics[subnet_id]["tasks_failed"] += 1

    def take_epoch_snapshot(
        self,
        epoch: int,
        active_miners: int = 0,
        active_subnets: int = 0,
    ) -> EpochSnapshot:
        """Take a snapshot of current protocol state."""
        avg_score = (
            sum(self._scores[-100:]) / len(self._scores[-100:])
            if self._scores
            else 0.0
        )
        snapshot = EpochSnapshot(
            epoch=epoch,
            timestamp=time.time(),
            total_tasks=self._tasks_submitted,
            completed_tasks=self._tasks_completed,
            total_volume=self._total_volume,
            active_miners=active_miners,
            active_subnets=active_subnets,
            avg_score=avg_score,
            protocol_revenue=self._total_revenue,
        )
        self._epoch_snapshots.append(snapshot)

        # Keep last 100 snapshots
        if len(self._epoch_snapshots) > 100:
            self._epoch_snapshots = self._epoch_snapshots[-100:]

        return snapshot

    def get_dashboard_metrics(self) -> Dict[str, Any]:
        """Get all metrics formatted for the dashboard."""
        uptime = time.time() - self._started_at

        avg_completion = (
            sum(self._completion_times) / len(self._completion_times)
            if self._completion_times
            else 0.0
        )
        avg_score = (
            sum(self._scores) / len(self._scores) if self._scores else 0.0
        )
        completion_rate = (
            self._tasks_completed / self._tasks_submitted
            if self._tasks_submitted > 0
            else 0.0
        )

        # Tasks per hour
        tph = (
            self._tasks_submitted / (uptime / 3600) if uptime > 0 else 0.0
        )

        return {
            "overview": {
                "total_tasks": self._tasks_submitted,
                "completed_tasks": self._tasks_completed,
                "failed_tasks": self._tasks_failed,
                "completion_rate": round(completion_rate, 4),
                "total_volume": round(self._total_volume, 4),
                "protocol_revenue": round(self._total_revenue, 4),
                "uptime_hours": round(uptime / 3600, 2),
                "tasks_per_hour": round(tph, 2),
            },
            "performance": {
                "avg_completion_time": round(avg_completion, 2),
                "avg_score": round(avg_score, 4),
                "p95_completion_time": round(
                    self._percentile(self._completion_times, 0.95), 2
                ),
            },
            "subnets": {
                sid: metrics
                for sid, metrics in self._subnet_metrics.items()
            },
            "epoch_history": [
                s.to_dict() for s in self._epoch_snapshots[-10:]
            ],
        }

    def get_subnet_ranking(self) -> List[Dict[str, Any]]:
        """Get subnets ranked by volume."""
        result = []
        for sid, metrics in self._subnet_metrics.items():
            result.append({
                "subnet_id": sid,
                "volume": round(metrics["volume"], 4),
                "tasks_completed": metrics["tasks_completed"],
                "avg_score": round(metrics["avg_score"], 4),
            })
        result.sort(key=lambda x: x["volume"], reverse=True)
        return result

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _init_subnet(self, subnet_id: int) -> None:
        if subnet_id not in self._subnet_metrics:
            self._subnet_metrics[subnet_id] = {
                "tasks_submitted": 0,
                "tasks_completed": 0,
                "tasks_failed": 0,
                "volume": 0.0,
                "avg_score": 0.0,
            }

    def _record_hourly_volume(self, amount: float) -> None:
        hour = int(time.time() / 3600)
        self._hourly_volume[hour] = self._hourly_volume.get(hour, 0) + amount
        # Keep last 24 hours
        cutoff = hour - 24
        self._hourly_volume = {
            h: v for h, v in self._hourly_volume.items() if h > cutoff
        }

    @staticmethod
    def _running_avg(current: float, new_value: float, count: int) -> float:
        if count <= 1:
            return new_value
        return current + (new_value - current) / count

    @staticmethod
    def _percentile(data: List[float], p: float) -> float:
        if not data:
            return 0.0
        sorted_data = sorted(data)
        idx = int(len(sorted_data) * p)
        idx = min(idx, len(sorted_data) - 1)
        return sorted_data[idx]
