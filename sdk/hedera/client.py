"""
Hedera Client Module - Using Official hiero-sdk-python

Main client for interacting with the Hedera network.
Uses official hiero-sdk-python SDK types directly - no custom wrappers.

For ModernTensor on Hedera - Hello Future Hackathon 2026
"""

import os
import logging
from typing import Optional, Dict, Any

# Official Hedera SDK imports - use their types directly
from hiero_sdk_python import (
    # Core
    Network,
    Client,
    AccountId,
    PrivateKey,
    Hbar,
    # Account
    CryptoGetAccountBalanceQuery,
    AccountInfoQuery,
    AccountInfo,
    TransferTransaction,
    # HCS
    TopicCreateTransaction,
    TopicDeleteTransaction,
    TopicMessageSubmitTransaction,
    TopicInfoQuery,
    TopicId,
    # HTS
    TokenCreateTransaction,
    TokenAssociateTransaction,
    TokenId,
    TokenInfoQuery,
    TokenInfo,
    TokenType,
    SupplyType,
    # Smart Contracts
    ContractCreateTransaction,
    ContractExecuteTransaction,
    ContractCallQuery,
    ContractFunctionParameters,
    ContractInfo,
    # Transactions
    TransactionId,
    TransactionReceipt,
    TransactionResponse,
)

# Support both relative and direct imports
try:
    from .config import HederaConfig, load_hedera_config, NetworkType
    from .errors import HederaConnectionError, HederaTransactionError
except ImportError:
    from config import HederaConfig, load_hedera_config, NetworkType
    from errors import HederaConnectionError, HederaTransactionError

logger = logging.getLogger(__name__)


class HederaClient:
    """
    Main client for interacting with Hedera network.

    Uses official hiero-sdk-python SDK - returns SDK types directly.

    Usage:
        from sdk.hedera import HederaClient

        # Create from environment
        client = HederaClient.from_env()

        # Query balance - returns SDK AccountInfo
        balance = client.get_balance()
        print(f"Balance: {balance.hbars} HBAR")

        # Create topic - returns topic ID string
        topic_id = client.create_topic(memo="My Topic")

        # Submit message - returns SDK TransactionReceipt
        receipt = client.submit_message(topic_id, "Hello")
    """

    def __init__(self, config: HederaConfig):
        """
        Initialize Hedera client with config.

        Args:
            config: HederaConfig with network settings and credentials
        """
        self.config = config
        self._client: Optional[Client] = None
        self._operator_id: Optional[AccountId] = None
        self._operator_key: Optional[PrivateKey] = None

        self._initialize()

    def _initialize(self):
        """Initialize the SDK client."""
        try:
            # Create network connection
            network = Network(self.config.network.value)
            self._client = Client(network)

            # Set operator if credentials provided
            if self.config.account_id and self.config.private_key:
                self._operator_id = AccountId.from_string(self.config.account_id)

                # Handle different key formats
                pk = self.config.private_key
                if pk.startswith("0x"):
                    # ECDSA key in hex format
                    key_bytes = bytes.fromhex(pk[2:])
                    self._operator_key = PrivateKey.from_bytes_ecdsa(key_bytes)
                elif len(pk) == 64 and all(c in "0123456789abcdefABCDEF" for c in pk):
                    # ECDSA key in hex without 0x prefix
                    key_bytes = bytes.fromhex(pk)
                    self._operator_key = PrivateKey.from_bytes_ecdsa(key_bytes)
                else:
                    # DER encoded or other format
                    self._operator_key = PrivateKey.from_string(pk)

                self._client.set_operator(self._operator_id, self._operator_key)
                logger.info(
                    f"Connected to Hedera {self.config.network.value} as {self.config.account_id}"
                )
            else:
                logger.warning("No operator credentials provided - read-only mode")

        except Exception as e:
            logger.error(f"Failed to initialize Hedera client: {e}")
            raise HederaConnectionError(f"Connection failed: {e}")

    @classmethod
    def from_env(cls, env_file: str = ".env") -> "HederaClient":
        """Create client from environment variables."""
        from dotenv import load_dotenv

        load_dotenv(env_file)
        return cls(load_hedera_config())

    @classmethod
    def from_config(cls) -> "HederaClient":
        """Create client from default config."""
        return cls(load_hedera_config())

    @property
    def client(self) -> Client:
        """Get underlying SDK client."""
        if not self._client:
            raise HederaConnectionError("Client not initialized")
        return self._client

    @property
    def operator_id(self) -> AccountId:
        """Get operator AccountId (SDK type)."""
        if not self._operator_id:
            raise HederaTransactionError("No operator set")
        return self._operator_id

    @property
    def operator_id_str(self) -> str:
        """Get operator account ID as string."""
        return str(self._operator_id) if self._operator_id else ""

    # =========================================================================
    # Account Operations - Returns SDK types directly
    # =========================================================================

    def get_balance(self, account_id: Optional[str] = None) -> Any:
        """
        Get account balance.

        Args:
            account_id: Account to query (default: operator)

        Returns:
            SDK balance object with .hbars and .tokens
        """
        target = AccountId.from_string(account_id) if account_id else self._operator_id
        if not target:
            raise HederaTransactionError("No account ID specified")

        query = CryptoGetAccountBalanceQuery(account_id=target)
        return query.execute(self.client)

    def get_account_info(self, account_id: Optional[str] = None) -> AccountInfo:
        """
        Get account information.

        Args:
            account_id: Account to query (default: operator)

        Returns:
            SDK AccountInfo object
        """
        target = AccountId.from_string(account_id) if account_id else self._operator_id
        if not target:
            raise HederaTransactionError("No account ID specified")

        query = AccountInfoQuery()
        query.set_account_id(target)
        return query.execute(self.client)

    def transfer_hbar(
        self, to_account: str, amount: float, memo: str = ""
    ) -> TransactionReceipt:
        """
        Transfer HBAR to another account.

        Args:
            to_account: Recipient account ID
            amount: Amount in HBAR
            memo: Transaction memo

        Returns:
            SDK TransactionReceipt
        """
        tx = TransferTransaction()
        tx.add_hbar_transfer(self._operator_id, Hbar(-amount))
        tx.add_hbar_transfer(AccountId.from_string(to_account), Hbar(amount))

        if memo:
            tx.set_transaction_memo(memo)

        receipt = tx.execute(self.client)
        return receipt

    # =========================================================================
    # HCS Operations - Hedera Consensus Service
    # =========================================================================

    def create_topic(
        self, memo: str = "", admin_key: bool = True, submit_key: bool = False
    ) -> str:
        """
        Create a new HCS topic.

        Args:
            memo: Topic memo
            admin_key: Whether to set admin key
            submit_key: Whether to require submit key

        Returns:
            Topic ID string (e.g., "0.0.12345")
        """
        tx = TopicCreateTransaction()

        if memo:
            tx.set_memo(memo)

        if admin_key and self._operator_key:
            tx.set_admin_key(self._operator_key.public_key())

        if submit_key and self._operator_key:
            tx.set_submit_key(self._operator_key.public_key())

        receipt = tx.execute(self.client)

        topic_id = str(receipt.topic_id)
        logger.info(f"Created topic: {topic_id}")
        return topic_id

    def delete_topic(self, topic_id: str) -> TransactionReceipt:
        """Delete an HCS topic."""
        tx = TopicDeleteTransaction()
        tx.set_topic_id(TopicId.from_string(topic_id))

        receipt = tx.execute(self.client)
        return receipt

    def submit_message(self, topic_id: str, message: str) -> TransactionReceipt:
        """
        Submit a message to an HCS topic.

        Args:
            topic_id: Topic ID
            message: Message content (string — will be UTF-8 encoded to bytes)

        Returns:
            SDK TransactionReceipt (has .topic_sequence_number)
        """
        tx = TopicMessageSubmitTransaction()
        tx.set_topic_id(TopicId.from_string(topic_id))
        # SDK's _build_proto_body does bytes(self.message, "utf-8") — must pass str, not bytes
        message_str = message.decode("utf-8") if isinstance(message, bytes) else message
        tx.set_message(message_str)

        receipt = tx.execute(self.client)
        return receipt

    def get_topic_info(self, topic_id: str) -> Any:
        """
        Get topic information.

        Args:
            topic_id: Topic ID

        Returns:
            SDK TopicInfo object
        """
        query = TopicInfoQuery()
        query.set_topic_id(TopicId.from_string(topic_id))
        return query.execute(self.client)

    # =========================================================================
    # HTS Operations - Hedera Token Service
    # =========================================================================

    def create_token(
        self,
        name: str,
        symbol: str,
        decimals: int = 8,
        initial_supply: int = 0,
        memo: str = "",
        max_supply: Optional[int] = None,
    ) -> str:
        """
        Create a new fungible token.

        Args:
            name: Token name
            symbol: Token symbol
            decimals: Decimal places
            initial_supply: Initial supply
            memo: Token memo
            max_supply: Max supply (None = infinite)

        Returns:
            Token ID string
        """
        tx = TokenCreateTransaction()
        tx.set_token_name(name)
        tx.set_token_symbol(symbol)
        tx.set_decimals(decimals)
        tx.set_initial_supply(initial_supply)
        tx.set_token_type(TokenType.FUNGIBLE_COMMON)
        tx.set_treasury_account_id(self._operator_id)

        if memo:
            tx.set_memo(memo)

        if max_supply:
            tx.set_supply_type(SupplyType.FINITE)
            tx.set_max_supply(max_supply)
        else:
            tx.set_supply_type(SupplyType.INFINITE)

        if self._operator_key:
            tx.set_supply_key(self._operator_key.public_key())

        receipt = tx.execute(self.client)

        token_id = str(receipt.token_id)
        logger.info(f"Created token: {token_id}")
        return token_id

    def associate_token(
        self, token_id: str, account_id: Optional[str] = None
    ) -> TransactionReceipt:
        """Associate a token with an account."""
        target = AccountId.from_string(account_id) if account_id else self._operator_id

        tx = TokenAssociateTransaction()
        tx.set_account_id(target)
        tx.set_token_ids([TokenId.from_string(token_id)])

        receipt = tx.execute(self.client)
        return receipt

    def approve_token_allowance(
        self,
        token_id: str,
        spender_account_id: str,
        amount: int,
    ) -> TransactionReceipt:
        """
        Approve a spender (contract or account) to transfer tokens on behalf of the operator.

        Required before any contract call that uses safeTransferFrom (e.g. createTask, stake, registerSubnet).

        Args:
            token_id: Token ID (e.g. "0.0.7852345")
            spender_account_id: Spender account/contract ID (e.g. "0.0.8101733")
            amount: Allowance amount in smallest token unit

        Returns:
            SDK TransactionReceipt
        """
        from hiero_sdk_python.account.account_allowance_approve_transaction import (
            AccountAllowanceApproveTransaction,
        )

        tx = AccountAllowanceApproveTransaction()
        tx.approve_token_allowance(
            token_id=TokenId.from_string(token_id),
            owner_account_id=self._operator_id,
            spender_account_id=AccountId.from_string(spender_account_id),
            amount=amount,
        )
        receipt = tx.execute(self.client)
        logger.info(
            f"Approved {amount} tokens of {token_id} for spender {spender_account_id}"
        )
        return receipt

    def transfer_token(
        self, token_id: str, to_account: str, amount: int
    ) -> TransactionReceipt:
        """
        Transfer tokens to another account.

        Args:
            token_id: Token ID
            to_account: Recipient account
            amount: Amount (in smallest unit)

        Returns:
            SDK TransactionReceipt
        """
        token = TokenId.from_string(token_id)

        tx = TransferTransaction()
        tx.add_token_transfer(token, self._operator_id, -amount)
        tx.add_token_transfer(token, AccountId.from_string(to_account), amount)

        receipt = tx.execute(self.client)
        return receipt

    def get_token_info(self, token_id: str) -> TokenInfo:
        """
        Get token information.

        Args:
            token_id: Token ID

        Returns:
            SDK TokenInfo object
        """
        query = TokenInfoQuery()
        query.set_token_id(TokenId.from_string(token_id))
        return query.execute(self.client)

    # =========================================================================
    # Smart Contract Operations
    # =========================================================================

    def deploy_contract(
        self,
        bytecode: bytes,
        gas: int = 500_000,
        constructor_params: Optional[bytes] = None,
    ) -> str:
        """
        Deploy a smart contract.

        For large bytecodes (>4KB), uses FileCreate + FileAppend to upload
        the bytecode first, then references the file ID in ContractCreate.

        Args:
            bytecode: Contract bytecode
            gas: Gas limit
            constructor_params: Constructor parameters

        Returns:
            Contract ID string
        """
        from hiero_sdk_python import (
            FileCreateTransaction,
            FileAppendTransaction,
        )

        CHUNK_SIZE = 4096  # 4KB chunks

        if len(bytecode) > CHUNK_SIZE:
            logger.info(
                "Bytecode %d bytes — uploading via FileCreate + FileAppend",
                len(bytecode),
            )

            # Create file with first chunk
            first_chunk = bytecode[:CHUNK_SIZE]
            file_tx = FileCreateTransaction()
            file_tx.set_contents(first_chunk)
            if self._operator_key:
                file_tx.set_keys([self._operator_key.public_key()])
            file_receipt = file_tx.execute(self.client)
            file_id = file_receipt.file_id
            logger.info(f"Created bytecode file: {file_id}")

            # Append remaining chunks
            remaining = bytecode[CHUNK_SIZE:]
            chunk_num = 1
            while remaining:
                chunk = remaining[:CHUNK_SIZE]
                remaining = remaining[CHUNK_SIZE:]
                append_tx = FileAppendTransaction()
                append_tx.set_file_id(file_id)
                append_tx.set_contents(chunk)
                append_tx.execute(self.client)
                chunk_num += 1
                logger.info(f"Appended chunk {chunk_num} ({len(chunk)} bytes)")

            # Deploy from file
            tx = ContractCreateTransaction()
            tx.set_bytecode_file_id(file_id)
            tx.set_gas(gas)
        else:
            tx = ContractCreateTransaction()
            tx.set_bytecode(bytecode)
            tx.set_gas(gas)

        if constructor_params:
            tx.set_constructor_parameters(constructor_params)

        if self._operator_key:
            tx.set_admin_key(self._operator_key.public_key())

        receipt = tx.execute(self.client)

        contract_id = str(receipt.contract_id)
        logger.info(f"Deployed contract: {contract_id}")
        return contract_id

    def execute_contract(
        self,
        contract_id: str,
        function_name: str,
        params: Optional[ContractFunctionParameters] = None,
        gas: int = 100_000,
        payable_amount: float = 0,
    ) -> TransactionReceipt:
        """
        Execute a contract function (state-changing).

        Args:
            contract_id: Contract ID
            function_name: Function to call
            params: Function parameters (SDK ContractFunctionParameters)
            gas: Gas limit
            payable_amount: HBAR to send

        Returns:
            SDK TransactionReceipt
        """
        from hiero_sdk_python.contract.contract_id import ContractId

        tx = ContractExecuteTransaction()
        tx.set_contract_id(ContractId.from_string(contract_id))
        tx.set_gas(gas)

        if params:
            tx.set_function(function_name, params)
        else:
            tx.set_function(function_name)

        if payable_amount > 0:
            tx.set_payable_amount(Hbar(payable_amount))

        receipt = tx.execute(self.client)
        return receipt

    def call_contract(
        self,
        contract_id: str,
        function_name: str,
        params: Optional[ContractFunctionParameters] = None,
        gas: int = 100_000,
    ) -> Any:
        """
        Call a contract function (read-only query).

        Args:
            contract_id: Contract ID
            function_name: Function to call
            params: Function parameters
            gas: Gas limit

        Returns:
            SDK ContractFunctionResult
        """
        from hiero_sdk_python.contract.contract_id import ContractId

        query = ContractCallQuery()
        query.set_contract_id(ContractId.from_string(contract_id))
        query.set_gas(gas)

        if params:
            query.set_function(function_name, params)
        else:
            query.set_function(function_name)

        return query.execute(self.client)

    # =========================================================================
    # Lifecycle
    # =========================================================================

    def close(self):
        """Close the client connection."""
        if self._client:
            try:
                self._client.close()
            except Exception:
                pass
            self._client = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


# =========================================================================
# Convenience Functions
# =========================================================================


def connect_hedera(
    network: str = "testnet",
    account_id: Optional[str] = None,
    private_key: Optional[str] = None,
) -> HederaClient:
    """
    Quick connect to Hedera network.

    Args:
        network: Network name (testnet, mainnet, previewnet)
        account_id: Operator account ID (or from env)
        private_key: Operator private key (or from env)

    Returns:
        HederaClient instance
    """
    from dotenv import load_dotenv

    load_dotenv()

    config = HederaConfig(
        network=NetworkType(network),
        account_id=account_id or os.getenv("HEDERA_ACCOUNT_ID", ""),
        private_key=private_key or os.getenv("HEDERA_PRIVATE_KEY", ""),
    )

    return HederaClient(config)


async def async_connect_hedera(
    network: str = "testnet",
    account_id: Optional[str] = None,
    private_key: Optional[str] = None,
) -> HederaClient:
    """Async wrapper (SDK is sync, so this just wraps sync client)."""
    return connect_hedera(network, account_id, private_key)
