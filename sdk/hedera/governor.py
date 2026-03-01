"""
MDT Governor Service - MDTGovernor Integration

On-chain governance for ModernTensor protocol.
For ModernTensor on Hedera - Hello Future Hackathon 2026
"""

import logging
from typing import Optional, TYPE_CHECKING
from enum import IntEnum

from hiero_sdk_python import ContractFunctionParameters

if TYPE_CHECKING:
    from .client import HederaClient

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
        cid = os.getenv("HEDERA_MDT_GOVERNOR_CONTRACT_ID")
        if cid and cid != "None":
            return cid
        return None

    @contract_id.setter
    def contract_id(self, value):
        self._contract_id = value

    def _require_contract(self):
        if not self.contract_id:
            raise ValueError("MDTGovernor contract not set.")

    def propose(self, target_address, call_data, description, gas=300_000):
        """
        Create a new governance proposal.

        Args:
            target_address: Contract to call if proposal passes
            call_data: Encoded function call bytes
            description: Human-readable description
        """
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_address(target_address)
        params.add_bytes(call_data)
        params.add_string(description)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="propose",
            params=params,
            gas=gas,
        )

    def vote(self, proposal_id, support, gas=150_000):
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

    def finalize_voting(self, proposal_id, gas=150_000):
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

    def execute(self, proposal_id, gas=300_000):
        """Execute a passed proposal."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(proposal_id)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="execute",
            params=params,
            gas=gas,
        )

    def cancel(self, proposal_id, gas=100_000):
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

    def get_proposal_state(self, proposal_id, gas=50_000):
        """Get proposal state."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(proposal_id)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="getProposalState",
            params=params,
            gas=gas,
        )

    def get_votes(self, proposal_id, gas=50_000):
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

    def has_voted(self, proposal_id, voter_address, gas=50_000):
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

    def set_quorum(self, quorum, gas=100_000):
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

    def set_voting_period(self, period, gas=100_000):
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

    def set_proposal_threshold(self, threshold, gas=100_000):
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
