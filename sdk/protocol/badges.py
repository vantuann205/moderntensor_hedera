"""
ModernTensor Badge System

Manages Verified Agent Badges via HCS (Hedera Consensus Service).
Badges prove that a miner/validator has passed PoI verification
and maintains good reputation.

Badge lifecycle:
    1. Issue: After miner passes PoI with score > threshold
    2. Verify: Anyone can check badge status via HCS messages
    3. Revoke: Auto-revoked if reputation drops below threshold
    4. Renew: Annual renewal (100 MDT) to stay verified

For ModernTensor on Hedera - Hello Future Hackathon 2026
"""

from __future__ import annotations

import json
import hashlib
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from ..hedera.hcs import HCSService

logger = logging.getLogger(__name__)


@dataclass
class Badge:
    """Represents a verified agent badge."""
    badge_id: str = ""
    agent_id: str = ""
    badge_type: str = "verified_agent"  # verified_agent, top_performer, specialist
    issued_at: float = 0.0
    expires_at: float = 0.0
    poi_score: float = 0.0
    is_active: bool = True
    revoked_at: Optional[float] = None
    revoke_reason: Optional[str] = None

    def __post_init__(self):
        if not self.badge_id:
            raw = f"{self.agent_id}:{self.badge_type}:{self.issued_at}"
            self.badge_id = hashlib.sha256(raw.encode()).hexdigest()[:16]

    def is_expired(self) -> bool:
        return time.time() > self.expires_at

    def to_dict(self) -> Dict[str, Any]:
        return {
            "badge_id": self.badge_id,
            "agent_id": self.agent_id,
            "badge_type": self.badge_type,
            "issued_at": self.issued_at,
            "expires_at": self.expires_at,
            "poi_score": self.poi_score,
            "is_active": self.is_active,
            "revoked_at": self.revoked_at,
            "revoke_reason": self.revoke_reason,
        }


class BadgeManager:
    """
    Manages Verified Agent Badges via HCS.

    Badges are recorded as HCS messages for immutable, timestamped proof.
    The badge topic stores the full badge lifecycle (issue, revoke, renew).

    Usage:
        badges = BadgeManager(hcs_service, topic_id="0.0.54321")

        # Issue a badge
        badge = badges.issue_badge("miner_001", poi_score=0.85)

        # Check badge
        if badges.is_verified("miner_001"):
            print("Verified agent!")

        # Revoke badge
        badges.revoke_badge("miner_001", reason="Reputation below threshold")
    """

    # Badge validity period (1 year)
    DEFAULT_VALIDITY = 365 * 24 * 3600

    # Minimum PoI score to earn a badge
    MIN_POI_SCORE = 0.60

    # Reputation threshold below which badge is auto-revoked
    REPUTATION_THRESHOLD = 0.15

    def __init__(
        self,
        hcs_service: Optional["HCSService"] = None,
        topic_id: Optional[str] = None,
    ):
        self.hcs = hcs_service
        self.topic_id = topic_id

        # Local badge registry (in-memory, synced from HCS)
        self._badges: Dict[str, Badge] = {}
        self._revocations: Dict[str, float] = {}

        logger.info("BadgeManager initialized (topic=%s)", topic_id)

    # ------------------------------------------------------------------
    # Badge Issuance
    # ------------------------------------------------------------------

    def issue_badge(
        self,
        agent_id: str,
        poi_score: float,
        badge_type: str = "verified_agent",
        validity_seconds: Optional[float] = None,
    ) -> Badge:
        """
        Issue a Verified Agent Badge.

        Args:
            agent_id: Miner or validator ID
            poi_score: PoI verification score (must be >= MIN_POI_SCORE)
            badge_type: Type of badge
            validity_seconds: How long the badge is valid

        Returns:
            The issued Badge

        Raises:
            ValueError: If PoI score is below minimum
        """
        if poi_score < self.MIN_POI_SCORE:
            raise ValueError(
                f"PoI score {poi_score:.2f} below minimum {self.MIN_POI_SCORE}"
            )

        now = time.time()
        validity = validity_seconds or self.DEFAULT_VALIDITY

        badge = Badge(
            agent_id=agent_id,
            badge_type=badge_type,
            issued_at=now,
            expires_at=now + validity,
            poi_score=poi_score,
            is_active=True,
        )

        self._badges[agent_id] = badge

        # Publish to HCS for immutable record
        self._publish_event("BADGE_ISSUED", badge.to_dict())

        logger.info(
            "Badge issued: agent=%s, type=%s, score=%.2f, valid_until=%s",
            agent_id, badge_type, poi_score,
            time.strftime("%Y-%m-%d", time.gmtime(badge.expires_at)),
        )
        return badge

    # ------------------------------------------------------------------
    # Badge Revocation
    # ------------------------------------------------------------------

    def revoke_badge(self, agent_id: str, reason: str = "Reputation threshold") -> bool:
        """
        Revoke a badge.

        Args:
            agent_id: Agent whose badge to revoke
            reason: Reason for revocation

        Returns:
            True if badge was revoked
        """
        badge = self._badges.get(agent_id)
        if not badge or not badge.is_active:
            return False

        badge.is_active = False
        badge.revoked_at = time.time()
        badge.revoke_reason = reason
        self._revocations[agent_id] = badge.revoked_at

        self._publish_event("BADGE_REVOKED", {
            "agent_id": agent_id,
            "badge_id": badge.badge_id,
            "reason": reason,
            "revoked_at": badge.revoked_at,
        })

        logger.warning("Badge revoked: agent=%s, reason=%s", agent_id, reason)
        return True

    def auto_revoke_if_needed(self, agent_id: str, reputation_score: float) -> bool:
        """
        Auto-revoke badge if reputation drops below threshold.

        Args:
            agent_id: Agent to check
            reputation_score: Current reputation (0-1)

        Returns:
            True if badge was auto-revoked
        """
        if reputation_score < self.REPUTATION_THRESHOLD:
            return self.revoke_badge(
                agent_id,
                reason=f"Reputation {reputation_score:.2f} below threshold {self.REPUTATION_THRESHOLD}",
            )
        return False

    # ------------------------------------------------------------------
    # Badge Queries
    # ------------------------------------------------------------------

    def is_verified(self, agent_id: str) -> bool:
        """Check if an agent has an active, non-expired badge."""
        badge = self._badges.get(agent_id)
        if not badge:
            return False
        return badge.is_active and not badge.is_expired()

    def get_badge(self, agent_id: str) -> Optional[Badge]:
        """Get badge for an agent."""
        return self._badges.get(agent_id)

    def get_all_verified(self) -> List[str]:
        """Get all agents with active badges."""
        return [
            agent_id for agent_id, badge in self._badges.items()
            if badge.is_active and not badge.is_expired()
        ]

    def get_stats(self) -> Dict[str, Any]:
        """Get badge system statistics."""
        active = sum(1 for b in self._badges.values() if b.is_active and not b.is_expired())
        expired = sum(1 for b in self._badges.values() if b.is_expired())
        revoked = sum(1 for b in self._badges.values() if not b.is_active)

        return {
            "total_issued": len(self._badges),
            "active": active,
            "expired": expired,
            "revoked": revoked,
            "total_revocations": len(self._revocations),
        }

    # ------------------------------------------------------------------
    # HCS Publishing
    # ------------------------------------------------------------------

    def _publish_event(self, event_type: str, data: Dict[str, Any]) -> None:
        """Publish a badge event to HCS topic."""
        if not self.hcs or not self.topic_id:
            logger.debug("HCS not configured — badge event stored locally only")
            return

        message = json.dumps({
            "type": event_type,
            "timestamp": time.time(),
            **data,
        })

        try:
            self.hcs.submit_message(self.topic_id, message)
        except Exception as e:
            logger.error("Failed to publish badge event: %s", e)
