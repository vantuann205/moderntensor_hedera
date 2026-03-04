"""
Staking Vault Service - StakingVault Integration

Manages MDT token staking for miners and validators.
For ModernTensor on Hedera - Hello Future Hackathon 2026
"""

import logging
from typing import Optional, TYPE_CHECKING
from enum import IntEnum

from hiero_sdk_python import ContractFunctionParameters

if TYPE_CHECKING:
    from .client import HederaClient

logger = logging.getLogger(__name__)


class StakeRole(IntEnum):
    """Staking role matching StakingVaultV2.sol (V1 used different ordinals)"""

    NONE = 0
    MINER = 1
    VALIDATOR = 2


class StakingVaultService:
    """
    Service for StakingVault contract operations.
    Manages MDT token staking, unstaking, and slashing.
    """

    def __init__(self, client: "HederaClient"):
        self.client = client
        self.config = client.config
        self._contract_id = None

    @property
    def contract_id(self):
        if self._contract_id:
            return self._contract_id
        import os

        cid = os.getenv("HEDERA_STAKING_VAULT_CONTRACT_ID")
        if cid and cid != "None":
            return cid
        return None

    @contract_id.setter
    def contract_id(self, value):
        self._contract_id = value

    def _require_contract(self):
        if not self.contract_id:
            raise ValueError("StakingVault contract not set.")

    def stake(self, amount, role=StakeRole.MINER, gas=200_000):
        """Stake MDT tokens as MINER(0) or VALIDATOR(1)."""
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

    def request_unstake(self, gas=100_000):
        """Request to unstake (starts cooldown period)."""
        self._require_contract()
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="requestUnstake",
            gas=gas,
        )

    def withdraw(self, gas=150_000):
        """Withdraw staked tokens after cooldown."""
        self._require_contract()
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="withdraw",
            gas=gas,
        )

    def slash(self, user_address, amount, gas=200_000):
        """Slash a staker's tokens (owner only)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_address(user_address)
        params.add_uint256(amount)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="slash",
            params=params,
            gas=gas,
        )

    def is_staked(self, user_address, gas=50_000):
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

    def is_validator(self, user_address, gas=50_000):
        """Check if address is a validator."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_address(user_address)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="isValidator",
            params=params,
            gas=gas,
        )

    def is_miner(self, user_address, gas=50_000):
        """Check if address is a miner."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_address(user_address)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="isMiner",
            params=params,
            gas=gas,
        )

    def get_stake_info(self, user_address, gas=50_000):
        """Get stake info for an address."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_address(user_address)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="getStakeInfo",
            params=params,
            gas=gas,
        )

    def set_min_miner_stake(self, min_stake, gas=100_000):
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

    def set_min_validator_stake(self, min_stake, gas=100_000):
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

    def pause(self, gas=50_000):
        """Pause contract (owner only)."""
        self._require_contract()
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="pause",
            gas=gas,
        )

    def unpause(self, gas=50_000):
        """Unpause contract (owner only)."""
        self._require_contract()
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="unpause",
            gas=gas,
        )
