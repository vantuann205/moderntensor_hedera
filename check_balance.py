import os
from dotenv import load_dotenv
from sdk.hedera.config import load_hedera_config
from sdk.hedera.client import HederaClient
from hiero_sdk_python import TokenId

load_dotenv()

def check_account():
    config = load_hedera_config()
    client = HederaClient(config)
    operator_id = client.operator_id_str
    mdt_id = os.getenv("HEDERA_MDT_TOKEN_ID", "0.0.8146318")
    
    print(f"Checking Account: {operator_id}")
    print(f"MDT Token ID: {mdt_id}")
    
    try:
        # Use AccountInfoQuery for more details
        info = client.get_account_info()
        print(f"HBAR Balance: {info.balance}")
        
        # Check token relationships
        mdt_found = False
        mdt_balance = 0
        
        # info.token_relationships is a list of TokenRelationship
        if hasattr(info, 'token_relationships'):
            for rel in info.token_relationships:
                if str(rel.token_id) == mdt_id:
                    mdt_found = True
                    mdt_balance = rel.balance
                    print(f"MDT Relationship Found: Balance={mdt_balance / 1e8} MDT")
                    break
        
        if not mdt_found:
            print(f"WARNING: Account is NOT associated with MDT token {mdt_id}")
        elif mdt_balance == 0:
            print("WARNING: MDT balance is 0. Staking will fail.")
        else:
            print(f"SUCCESS: Account has {mdt_balance / 1e8} MDT")

        # Check Token Info for Treasury
        try:
            token_info = client.get_token_info(mdt_id)
            print(f"Token: {token_info.name} ({token_info.symbol})")
            print(f"Treasury: {token_info.treasury_account_id}")
            if str(token_info.treasury_account_id) == operator_id:
                print("YOU ARE THE TREASURY.")
        except Exception as e:
            print(f"Could not get token info: {e}")

    except Exception as e:
        print(f"Error checking account info: {e}")
        # Fallback to dir() to debug
        try:
            balance = client.get_balance()
            print(f"Balance object attributes: {dir(balance)}")
        except:
            pass
    
    client.close()

if __name__ == "__main__":
    check_account()
