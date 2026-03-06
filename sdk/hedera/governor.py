"""
MDT Governor Service — MDTGovernor Contract Integration

On-chain governance for ModernTensor protocol parameters.

Contract ABI (MDTGovernor.sol):
  setAllowedTarget(address, bool), propose(string, address, bytes),
  vote(uint256, bool), finalizeVoting(uint256), execute(uint256), cancel(uint256),
  getProposalState(uint256), getVotes(uint256), hasVoted(uint256, address),
  setQuorum(uint256), setVotingPeriod(uint256), setProposalThreshold(uint256),
  setExecutionDelay(uint256)

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


class ProposalState(IntEnum):
    """Proposal state matching MDTGovernor.sol"""

    PENDING = 0
    ACTIVE = 1
    SUCCEEDED = 2
    DEFEATED = 3
    EXECUTED = 4
    CANCELLED = 5


class MDTGovernorService:
    """
    Service for MDTGovernor contract operations.
    On-chain governance: propose, vote, execute protocol changes.

    Usage:
        from sdk.hedera.governor import MDTGovernorService
        gov = MDTGovernorService(client)
        gov.contract_id = "0.0.8046041"

        gov.propose("Increase quorum", target_address, call_data)
        gov.vote(proposal_id=0, support=True)
        gov.finalize_voting(proposal_id=0)
        gov.execute(proposal_id=0)
    """

    def __init__(self, client: "HederaClient"):
        self.client = client
        self._contract_id: Optional[str] = None

    @property
    def contract_id(self) -> Optional[str]:
        if self._contract_id:
            return self._contract_id
        import os

        cid = os.getenv("HEDERA_MDT_GOVERNOR_CONTRACT_ID")
        if cid and cid != "None":
            return cid
        return None

    @contract_id.setter
    def contract_id(self, value: str):
        self._contract_id = value

    def _require_contract(self):
        if not self.contract_id:
            raise ValueError("MDTGovernor contract not set.")

    # ── Admin ────────────────────────────────────────────────────

    def set_allowed_target(self, target: str, allowed: bool, gas: int = 100_000):
        """Set whether a contract address is an allowed governance target (owner only)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_address(target)
        params.add_bool(allowed)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="setAllowedTarget",
            params=params,
            gas=gas,
        )

    # ── Proposal Lifecycle ───────────────────────────────────────

    def propose(
        self,
        description: str,
        target_address: str,
        call_data: bytes,
        gas: int = 500_000,
    ):
        """
        Create a governance proposal.

        Args:
            description: Human-readable proposal description
            target_address: Contract to call if proposal passes
            call_data: Encoded function call bytes
        """
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_string(description)
        params.add_address(target_address)
        params.add_bytes(call_data)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="propose",
            params=params,
            gas=gas,
        )

    def vote(self, proposal_id: int, support: bool, gas: int = 150_000):
        """Vote on a proposal. support=True for, False against."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(proposal_id)
        params.add_bool(support)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="vote",
            params=params,
            gas=gas,
        )

    def finalize_voting(self, proposal_id: int, gas: int = 150_000):
        """Finalize voting period for a proposal."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(proposal_id)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="finalizeVoting",
            params=params,
            gas=gas,
        )

    def execute(self, proposal_id: int, gas: int = 800_000):
        """Execute a passed proposal after timelock."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(proposal_id)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="execute",
            params=params,
            gas=gas,
        )

    def cancel(self, proposal_id: int, gas: int = 100_000):
        """Cancel a proposal (proposer only)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(proposal_id)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="cancel",
            params=params,
            gas=gas,
        )

    # ── View Functions ───────────────────────────────────────────

    def get_proposal_state(
        self, proposal_id: int, gas: int = 50_000
    ) -> "ContractFunctionResult":
        """Get proposal state (PENDING, ACTIVE, SUCCEEDED, etc.)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(proposal_id)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="getProposalState",
            params=params,
            gas=gas,
        )

    def get_votes(
        self, proposal_id: int, gas: int = 50_000
    ) -> "ContractFunctionResult":
        """Get vote counts for a proposal."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(proposal_id)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="getVotes",
            params=params,
            gas=gas,
        )

    def has_voted(
        self, proposal_id: int, voter_address: str, gas: int = 50_000
    ) -> "ContractFunctionResult":
        """Check if an address has voted on a proposal."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(proposal_id)
        params.add_address(voter_address)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="hasVoted",
            params=params,
            gas=gas,
        )

    # ── Configuration (owner only) ───────────────────────────────

    def set_quorum(self, quorum: int, gas: int = 100_000):
        """Set quorum threshold (owner only)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(quorum)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="setQuorum",
            params=params,
            gas=gas,
        )

    def set_voting_period(self, period: int, gas: int = 100_000):
        """Set voting period in seconds (owner only)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(period)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="setVotingPeriod",
            params=params,
            gas=gas,
        )

    def set_proposal_threshold(self, threshold: int, gas: int = 100_000):
        """Set minimum tokens needed to propose (owner only)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(threshold)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="setProposalThreshold",
            params=params,
            gas=gas,
        )

    def set_execution_delay(self, delay: int, gas: int = 100_000):
        """Set execution delay / timelock in seconds (owner only)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(delay)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="setExecutionDelay",
            params=params,
            gas=gas,
        )

    def __repr__(self) -> str:
        return f"<MDTGovernorService contract={self.contract_id}>"
