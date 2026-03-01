"""
ModernTensor Staking Manager

SDK wrapper for StakingVault.sol — manages on-chain staking
for miners and validators.

For ModernTensor on Hedera - Hello Future Hackathon 2026
"""

from __future__ import annotations

import logging
from enum import IntEnum
from typing import Any, Dict, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from ..hedera.client import HederaClient

logger = logging.getLogger(__name__)


class StakeRole(IntEnum):
    """Matches StakingVault.sol StakeRole enum."""
    NONE = 0
    MINER = 1
    VALIDATOR = 2


class StakingManager:
    """
    SDK wrapper for StakingVault.sol on-chain staking.

    Manages the lifecycle: stake → active → requestUnstake → cooldown → withdraw.

    Usage:
        from sdk.hedera import HederaClient
        from sdk.protocol.staking import StakingManager

        client = HederaClient.from_env()
        staking = StakingManager(client, vault_contract_id="0.0.12345")

        # Stake as validator
        staking.stake(amount=50_000.0, role=StakeRole.VALIDATOR)

        # Check status
        info = staking.get_stake_info("0.0.11111")
        print(info)

        # Unstake
        staking.request_unstake()
        # ... wait 7 days ...
        staking.withdraw()
    """

    # MDT decimals (matching HTS token config)
    MDT_DECIMALS = 8

    def __init__(
        self,
        client: "HederaClient",
        vault_contract_id: Optional[str] = None,
    ):
        self.client = client
        self._vault_contract_id = vault_contract_id
        logger.info("StakingManager initialized (vault=%s)", vault_contract_id)

    @property
    def vault_contract_id(self) -> Optional[str]:
        return self._vault_contract_id

    @vault_contract_id.setter
    def vault_contract_id(self, value: str):
        self._vault_contract_id = value

    # ------------------------------------------------------------------
    # Staking Operations
    # ------------------------------------------------------------------

    def stake(
        self,
        amount: float,
        role: StakeRole,
        gas: int = 300_000,
    ) -> Any:
        """
        Stake MDT tokens for a role (Miner or Validator).

        Args:
            amount: Amount in MDT (e.g., 50000.0)
            role: StakeRole.MINER or StakeRole.VALIDATOR
            gas: Gas limit

        Returns:
            Transaction receipt
        """
        self._require_vault()
        raw_amount = int(amount * (10 ** self.MDT_DECIMALS))

        from hiero_sdk_python import ContractFunctionParameters

        params = ContractFunctionParameters()
        params.add_uint256(raw_amount)
        params.add_uint8(int(role))

        receipt = self.client.execute_contract(
            contract_id=self._vault_contract_id,
            function_name="stake",
            params=params,
            gas=gas,
        )

        logger.info(
            "Staked %.2f MDT as %s",
            amount, role.name,
        )
        return receipt

    def request_unstake(self, gas: int = 200_000) -> Any:
        """Request to unstake. Starts 7-day cooldown."""
        self._require_vault()

        receipt = self.client.execute_contract(
            contract_id=self._vault_contract_id,
            function_name="requestUnstake",
            gas=gas,
        )

        logger.info("Unstake requested — cooldown started")
        return receipt

    def withdraw(self, gas: int = 200_000) -> Any:
        """Withdraw staked tokens after cooldown period."""
        self._require_vault()

        receipt = self.client.execute_contract(
            contract_id=self._vault_contract_id,
            function_name="withdraw",
            gas=gas,
        )

        logger.info("Staked tokens withdrawn")
        return receipt

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    def is_staked(self, address: str, gas: int = 50_000) -> bool:
        """Check if an address is actively staked."""
        self._require_vault()

        result = self.client.call_contract(
            contract_id=self._vault_contract_id,
            function_name="isStaked",
            params=self._addr_params(address),
            gas=gas,
        )
        return result.get_bool(0) if result else False

    def is_validator(self, address: str, gas: int = 50_000) -> bool:
        """Check if address is staked as validator."""
        self._require_vault()

        result = self.client.call_contract(
            contract_id=self._vault_contract_id,
            function_name="isValidator",
            params=self._addr_params(address),
            gas=gas,
        )
        return result.get_bool(0) if result else False

    def is_miner(self, address: str, gas: int = 50_000) -> bool:
        """Check if address is staked as miner."""
        self._require_vault()

        result = self.client.call_contract(
            contract_id=self._vault_contract_id,
            function_name="isMiner",
            params=self._addr_params(address),
            gas=gas,
        )
        return result.get_bool(0) if result else False

    def get_stake_info(self, address: str, gas: int = 50_000) -> Dict[str, Any]:
        """
        Get staking details for an address.

        Returns:
            Dict with amount, role, stakedAt, unstakeRequestedAt, isActive
        """
        self._require_vault()

        result = self.client.call_contract(
            contract_id=self._vault_contract_id,
            function_name="getStakeInfo",
            params=self._addr_params(address),
            gas=gas,
        )

        if not result:
            return {"amount": 0, "role": "NONE", "isActive": False}

        raw_amount = result.get_uint256(0)
        role_int = result.get_uint8(1)

        return {
            "amount": raw_amount / (10 ** self.MDT_DECIMALS),
            "amount_raw": raw_amount,
            "role": StakeRole(role_int).name,
            "staked_at": result.get_uint256(2),
            "unstake_requested_at": result.get_uint256(3),
            "is_active": result.get_bool(4),
        }

    def get_total_staked(self, gas: int = 50_000) -> float:
        """Get total MDT staked across all users."""
        self._require_vault()

        result = self.client.call_contract(
            contract_id=self._vault_contract_id,
            function_name="totalStaked",
            gas=gas,
        )
        raw = result.get_uint256(0) if result else 0
        return raw / (10 ** self.MDT_DECIMALS)

    # ------------------------------------------------------------------
    # Admin (owner-only on-chain)
    # ------------------------------------------------------------------

    def slash(
        self,
        user_address: str,
        basis_points: int,
        reason: str,
        gas: int = 300_000,
    ) -> Any:
        """
        Slash a staker's tokens (owner only).

        Args:
            user_address: Address to slash
            basis_points: Slash % in basis points (1000 = 10%)
            reason: Human-readable reason
        """
        self._require_vault()

        from hiero_sdk_python import ContractFunctionParameters

        params = ContractFunctionParameters()
        params.add_address(user_address)
        params.add_uint256(basis_points)
        params.add_string(reason)

        receipt = self.client.execute_contract(
            contract_id=self._vault_contract_id,
            function_name="slash",
            params=params,
            gas=gas,
        )

        logger.warning(
            "Slashed %s by %d bps: %s",
            user_address, basis_points, reason,
        )
        return receipt

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _require_vault(self):
        if not self._vault_contract_id:
            raise ValueError(
                "StakingVault contract ID not set. "
                "Call staking.vault_contract_id = '0.0.xxxxx' first."
            )

    @staticmethod
    def _addr_params(address: str):
        from hiero_sdk_python import ContractFunctionParameters
        params = ContractFunctionParameters()
        params.add_address(address)
        return params
