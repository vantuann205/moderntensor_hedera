import json
import sys
import os
import argparse
import time
import logging
import warnings

# Suppress all warnings/logging so stdout only has JSON
logging.basicConfig(level=logging.CRITICAL)
logging.getLogger().disabled = True
warnings.filterwarnings("ignore")

from sdk.hedera import HederaClient
from sdk.hedera.hcs import HCSService, TaskSubmission, ScoreSubmission
from sdk.hedera.code_review import CodeReviewAgent

def safe_get(obj, *attrs):
    """Try to get attribute from object, return None if not found."""
    for attr in attrs:
        val = getattr(obj, attr, None)
        if val is not None:
            return val
    return None

def main():
    parser = argparse.ArgumentParser(description="ModernTensor Sync API Inference & HCS Pipeline")
    parser.add_argument("--code", required=True, help="Inline code string OR file path to read code from")
    parser.add_argument("--language", default="solidity", help="Language (e.g. solidity, python)")
    parser.add_argument("--requester", default="0.0.2001", help="Requester Account ID")
    parser.add_argument("--reward", type=float, default=50.0, help="Reward amount in MDT")
    args = parser.parse_args()

    # Resolve code: if it looks like a file path and the file exists, read it
    code_str = args.code
    if os.path.isfile(code_str):
        with open(code_str, "r", encoding="utf-8", errors="ignore") as f:
            code_str = f.read()
    
    if not code_str.strip():
        print(json.dumps({"success": False, "error": "No code provided"}))
        sys.exit(1)

    # 1. Initialize Hedera
    try:
        client = HederaClient.from_env()
        hcs = HCSService(client)
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": f"Failed to initialize Hedera SDK: {str(e)}"
        }))
        sys.exit(1)

    # Make sure we have scoring topic (task topic optional)
    if not hcs.scoring_topic_id:
        print(json.dumps({
            "success": False,
            "error": "HCS Scoring Topic not configured in .env"
        }))
        sys.exit(1)

    # 2. AI Inference: Run Code Review Agent 
    agent = CodeReviewAgent(client, hcs)
    task_id = f"task-{int(time.time())}-api"
    miner_id = client.operator_id_str or "0.0.8127455"
    
    try:
        # CodeReviewAgent will try Google Gemini -> Anthropic -> OpenAI -> Heuristic
        result = agent.review_code(
            code=code_str,
            language=args.language,
            use_llm=True
        )
        
        # 3. Submit Task to Hedera HCS (if task topic exists)
        if hcs.task_topic_id:
            task_msg = TaskSubmission(
                task_id=task_id,
                requester_id=args.requester,
                task_type="code_review",
                prompt=code_str[:200] + ("..." if len(code_str) > 200 else ""),
                reward_amount=int(args.reward),
                deadline=int(time.time()) + 3600
            )
            try:
                hcs.create_task(task_msg)
            except Exception:
                pass  # Task topic optional

        # 4. Submit Score to Hedera HCS (required for audit trail)
        score_msg = ScoreSubmission(
            validator_id=miner_id,
            miner_id=miner_id,
            task_id=task_id,
            score=result.overall_score,
            confidence=result.confidence,
            metrics={
                "security": result.security,
                "correctness": result.correctness,
                "readability": result.readability,
                "best_practices": result.best_practices,
                "gas_efficiency": result.gas_efficiency,
                "vulnerabilities_count": len(result.vulnerabilities),
                "language": result.language,
            }
        )
        receipt = hcs.submit_score(score_msg)
        
        # Safe extract receipt fields
        seq_num = safe_get(receipt, 'topic_sequence_number', 'topicSequenceNumber')
        tx_id = safe_get(receipt, 'transaction_id', 'transactionId')
        timestamp_val = safe_get(receipt, 'consensus_timestamp', 'consensusTimestamp')
        
        tx_hash = str(tx_id) if tx_id else f"scored-seq-{seq_num or 'pending'}"
        timestamp = str(timestamp_val) if timestamp_val else str(time.time())
        
        response = {
            "success": True,
            "data": {
                "task_id": task_id,
                "result": {
                    "overall_score": result.overall_score,
                    "security": result.security,
                    "correctness": result.correctness,
                    "readability": result.readability,
                    "best_practices": result.best_practices,
                    "gas_efficiency": result.gas_efficiency,
                    "summary": result.summary,
                    "vulnerabilities": result.vulnerabilities,
                    "suggestions": result.suggestions,
                    "provider": result.provider,
                    "confidence": result.confidence,
                },
                "hedera": {
                    "txHash": tx_hash,
                    "consensusTimestamp": timestamp,
                    "sequence_number": seq_num
                }
            }
        }
        
        print(json.dumps(response))
        sys.exit(0)
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": f"AI or Hedera processing failed: {str(e)}"
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()
