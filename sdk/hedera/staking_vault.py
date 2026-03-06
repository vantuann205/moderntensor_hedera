"""
Staking Vault Service — StakingVault Contract Integration

Manages MDT token staking for miners and validators.
Contract ABI (StakingVault.sol):
  stake(uint256 amount, StakeRole role), requestUnstake(), withdraw(),
  slash(address user, uint256 basisPoints, string reason),
  isStaked(address), isValidator(address), isMiner(address), getStakeInfo(address),
  setMinMinerStake(uint256), setMinValidatorStake(uint256), setUnstakeCooldown(uint256),
  pause(), unpause()

For ModernTensor on Hedera — Hello Future Hackathon 2026
"""

import logging
from typing import Optional, TYPE_CHECKING
from enum import IntEnum

from hiero_sdk_python import ContractFunctionParameters

if TYPE_CHECKING:
    from .client import HederaClient
    from hiero_sdk_python import ContractFunctionResult

logger = logging.getLogger(__name__)


class StakeRole(IntEnum):
    """Staking role matching StakingVault.sol"""

    NONE = 0
    MINER = 1
    VALIDATOR = 2


class StakingVaultService:
    """
    Service for StakingVault contract operations.
    Manages MDT token staking, unstaking, slashing, and role queries.

    Usage:
        from sdk.hedera.staking_vault import StakingVaultService, StakeRole
        staking = StakingVaultService(client)
        staking.contract_id = "0.0.8046039"

        staking.stake(amount=100*10**8, role=StakeRole.MINER)
        staking.request_unstake()
        staking.withdraw()
    """

    def __init__(self, client: "HederaClient"):
        self.client = client
        self._contract_id: Optional[str] = None

    @property
    def contract_id(self) -> Optional[str]:
        if self._contract_id:
            return self._contract_id
        import os

        cid = os.getenv("HEDERA_STAKING_VAULT_CONTRACT_ID")
        if cid and cid != "None":
            return cid
        return None

    @contract_id.setter
    def contract_id(self, value: str):
        self._contract_id = value

    def _require_contract(self):
        if not self.contract_id:
            raise ValueError("StakingVault contract not set.")

    # ── Core Staking Operations ──────────────────────────────────

    def stake(self, amount: int, role: int = StakeRole.MINER, gas: int = 500_000):
        """Stake MDT tokens. role: MINER(1) or VALIDATOR(2)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(amount)
        params.add_uint8(int(role))
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="stake",
            params=params,
            gas=gas,
        )

    def request_unstake(self, gas: int = 100_000):
        """Request unstake (starts 7-day cooldown)."""
        self._require_contract()
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="requestUnstake",
            gas=gas,
        )

    def withdraw(self, gas: int = 500_000):
        """Withdraw staked tokens after cooldown period."""
        self._require_contract()
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="withdraw",
            gas=gas,
        )

    def slash(
        self,
        user_address: str,
        basis_points: int,
        reason: str,
        gas: int = 200_000,
    ):
        """Slash a staker (owner only). basis_points: 1-10000 (100% = 10000)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_address(user_address)
        params.add_uint256(basis_points)
        params.add_string(reason)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="slash",
            params=params,
            gas=gas,
        )

    # ── View / Query Functions ───────────────────────────────────

    def is_staked(
        self, user_address: str, gas: int = 50_000
    ) -> "ContractFunctionResult":
        """Check if address is staked."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_address(user_address)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="isStaked",
            params=params,
            gas=gas,
        )

    def is_validator(
        self, user_address: str, gas: int = 50_000
    ) -> "ContractFunctionResult":
        """Check if address is a staked validator."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_address(user_address)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="isValidator",
            params=params,
            gas=gas,
        )

    def is_miner(
        self, user_address: str, gas: int = 50_000
    ) -> "ContractFunctionResult":
        """Check if address is a staked miner."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_address(user_address)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="isMiner",
            params=params,
            gas=gas,
        )

    def get_stake_info(
        self, user_address: str, gas: int = 50_000
    ) -> "ContractFunctionResult":
        """Get stake info (amount, role, unstakeRequestedAt, slashed)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_address(user_address)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="getStakeInfo",
            params=params,
            gas=gas,
        )

    # ── Admin Functions ──────────────────────────────────────────

    def set_min_miner_stake(self, min_stake: int, gas: int = 100_000):
        """Set minimum miner stake (owner only)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(min_stake)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="setMinMinerStake",
            params=params,
            gas=gas,
        )

    def set_min_validator_stake(self, min_stake: int, gas: int = 100_000):
        """Set minimum validator stake (owner only)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(min_stake)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="setMinValidatorStake",
            params=params,
            gas=gas,
        )

    def set_unstake_cooldown(self, cooldown: int, gas: int = 100_000):
        """Set unstake cooldown period in seconds (owner only)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(cooldown)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="setUnstakeCooldown",
            params=params,
            gas=gas,
        )

    def pause(self, gas: int = 50_000):
        """Pause contract (owner only)."""
        self._require_contract()
        return self.client.execute_contract(
            contract_id=self.contract_id, function_name="pause", gas=gas
        )

    def unpause(self, gas: int = 50_000):
        """Unpause contract (owner only)."""
        self._require_contract()
        return self.client.execute_contract(
            contract_id=self.contract_id, function_name="unpause", gas=gas
        )

    def __repr__(self) -> str:
        return f"<StakingVaultService contract={self.contract_id}>"
