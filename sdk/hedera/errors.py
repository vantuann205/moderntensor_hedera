"""
Hedera Error Classes

Custom exceptions for Hedera integration with ModernTensor.
"""

from typing import Optional, Any


class HederaError(Exception):
    """Base exception for Hedera-related errors."""

    def __init__(
        self,
        message: str,
        code: Optional[str] = None,
        details: Optional[Any] = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details

    def __repr__(self) -> str:
        if self.code:
            return f"{self.__class__.__name__}(code={self.code}, message={self.message})"
        return f"{self.__class__.__name__}({self.message})"


class HederaConnectionError(HederaError):
    """Failed to connect to Hedera network."""
    pass


class HederaTransactionError(HederaError):
    """Transaction failed on Hedera."""

    def __init__(
        self,
        message: str,
        transaction_id: Optional[str] = None,
        status: Optional[str] = None,
        **kwargs,
    ):
        super().__init__(message, **kwargs)
        self.transaction_id = transaction_id
        self.status = status


class TopicNotFoundError(HederaError):
    """HCS Topic not found."""

    def __init__(self, topic_id: str, **kwargs):
        super().__init__(f"Topic not found: {topic_id}", **kwargs)
        self.topic_id = topic_id


class TopicCreateError(HederaError):
    """Failed to create HCS topic."""
    pass


class MessageSubmitError(HederaError):
    """Failed to submit message to HCS topic."""

    def __init__(
        self,
        message: str,
        topic_id: Optional[str] = None,
        **kwargs,
    ):
        super().__init__(message, **kwargs)
        self.topic_id = topic_id


class TokenNotFoundError(HederaError):
    """HTS Token not found."""

    def __init__(self, token_id: str, **kwargs):
        super().__init__(f"Token not found: {token_id}", **kwargs)
        self.token_id = token_id


class TokenCreateError(HederaError):
    """Failed to create HTS token."""
    pass


class TokenTransferError(HederaError):
    """Failed to transfer tokens."""

    def __init__(
        self,
        message: str,
        token_id: Optional[str] = None,
        from_account: Optional[str] = None,
        to_account: Optional[str] = None,
        amount: Optional[int] = None,
        **kwargs,
    ):
        super().__init__(message, **kwargs)
        self.token_id = token_id
        self.from_account = from_account
        self.to_account = to_account
        self.amount = amount


class InsufficientBalanceError(HederaError):
    """Insufficient balance for operation."""

    def __init__(
        self,
        required: int,
        available: int,
        token_id: Optional[str] = None,
        **kwargs,
    ):
        message = f"Insufficient balance: required {required}, available {available}"
        if token_id:
            message += f" (token: {token_id})"
        super().__init__(message, **kwargs)
        self.required = required
        self.available = available
        self.token_id = token_id


class ContractNotFoundError(HederaError):
    """Smart contract not found."""

    def __init__(self, contract_id: str, **kwargs):
        super().__init__(f"Contract not found: {contract_id}", **kwargs)
        self.contract_id = contract_id


class ContractCallError(HederaError):
    """Smart contract call failed."""

    def __init__(
        self,
        message: str,
        contract_id: Optional[str] = None,
        function_name: Optional[str] = None,
        **kwargs,
    ):
        super().__init__(message, **kwargs)
        self.contract_id = contract_id
        self.function_name = function_name


class ContractExecuteError(HederaError):
    """Smart contract execution failed."""

    def __init__(
        self,
        message: str,
        contract_id: Optional[str] = None,
        function_name: Optional[str] = None,
        transaction_id: Optional[str] = None,
        **kwargs,
    ):
        super().__init__(message, **kwargs)
        self.contract_id = contract_id
        self.function_name = function_name
        self.transaction_id = transaction_id


class AccountNotFoundError(HederaError):
    """Account not found on Hedera."""

    def __init__(self, account_id: str, **kwargs):
        super().__init__(f"Account not found: {account_id}", **kwargs)
        self.account_id = account_id


class InvalidKeyError(HederaError):
    """Invalid key format or type."""
    pass


class ConfigurationError(HederaError):
    """Invalid or missing configuration."""
    pass


class TimeoutError(HederaError):
    """Operation timed out."""

    def __init__(
        self,
        message: str = "Operation timed out",
        timeout_seconds: Optional[int] = None,
        **kwargs,
    ):
        super().__init__(message, **kwargs)
        self.timeout_seconds = timeout_seconds


class RateLimitError(HederaError):
    """Rate limit exceeded."""

    def __init__(
        self,
        message: str = "Rate limit exceeded",
        retry_after: Optional[int] = None,
        **kwargs,
    ):
        super().__init__(message, **kwargs)
        self.retry_after = retry_after


# Status code mappings from Hedera
HEDERA_STATUS_CODES = {
    "OK": "SUCCESS",
    "SUCCESS": "SUCCESS",
    "INVALID_TRANSACTION": "Transaction is invalid",
    "PAYER_ACCOUNT_NOT_FOUND": "Payer account not found",
    "INVALID_NODE_ACCOUNT": "Invalid node account",
    "TRANSACTION_EXPIRED": "Transaction expired",
    "INVALID_TRANSACTION_START": "Invalid transaction start time",
    "INVALID_TRANSACTION_DURATION": "Invalid transaction duration",
    "INVALID_SIGNATURE": "Invalid signature",
    "MEMO_TOO_LONG": "Memo exceeds maximum length",
    "INSUFFICIENT_TX_FEE": "Insufficient transaction fee",
    "INSUFFICIENT_PAYER_BALANCE": "Insufficient payer balance",
    "DUPLICATE_TRANSACTION": "Duplicate transaction",
    "ACCOUNT_ID_DOES_NOT_EXIST": "Account ID does not exist",
    "INVALID_ACCOUNT_ID": "Invalid account ID format",
    "TOPIC_EXPIRED": "Topic has expired",
    "INVALID_TOPIC_ID": "Invalid topic ID",
    "MESSAGE_SIZE_TOO_LARGE": "Message size exceeds maximum",
    "TOKEN_NOT_ASSOCIATED_TO_ACCOUNT": "Token not associated with account",
    "TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT": "Token already associated",
    "INSUFFICIENT_TOKEN_BALANCE": "Insufficient token balance",
    "CONTRACT_EXECUTION_EXCEPTION": "Contract execution failed",
    "CONTRACT_REVERT_EXECUTED": "Contract reverted",
}


def parse_hedera_status(status: str) -> str:
    """
    Parse Hedera status code to human-readable message.

    Args:
        status: Hedera status code string

    Returns:
        Human-readable status message
    """
    return HEDERA_STATUS_CODES.get(status, status)


def raise_for_status(status: str, context: str = "") -> None:
    """
    Raise appropriate exception based on Hedera status code.

    Args:
        status: Hedera status code
        context: Additional context for error message

    Raises:
        Appropriate HederaError subclass
    """
    if status in ("OK", "SUCCESS"):
        return

    message = parse_hedera_status(status)
    if context:
        message = f"{context}: {message}"

    # Map status to specific exceptions
    if "INSUFFICIENT" in status and "BALANCE" in status:
        raise InsufficientBalanceError(0, 0, details=status)
    elif "TOPIC" in status:
        raise TopicNotFoundError("", details=status)
    elif "TOKEN" in status:
        raise TokenTransferError(message, details=status)
    elif "CONTRACT" in status:
        raise ContractExecuteError(message, details=status)
    elif "ACCOUNT" in status:
        raise AccountNotFoundError("", details=status)
    else:
        raise HederaTransactionError(message, status=status)
