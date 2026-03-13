import urllib.request
import json
import base64
import time

def get_hcs_messages(topic_id, limit=3):
    url = f"https://testnet.mirrornode.hedera.com/api/v1/topics/{topic_id}/messages?limit={limit}&order=desc"
    try:
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode())
            messages = data.get("messages", [])
            print(f"\nTOPIC: {topic_id} - Latest {len(messages)} messages")
            for msg in messages:
                payload_b64 = msg.get("message", "")
                try:
                    payload = base64.b64decode(payload_b64).decode('utf-8', errors='ignore')
                except:
                    payload = "[Binary/Error]"
                
                timestamp = msg['consensus_timestamp']
                # Convert string timestamp to float
                ts_float = float(timestamp)
                readable_time = time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime(ts_float))
                
                print(f"  Seq: {msg['sequence_number']}")
                print(f"  Time: {timestamp} ({readable_time} UTC)")
                print(f"  Msg: {payload[:200]}")
                print("-" * 40)
    except Exception as e:
        print(f"Error fetching {topic_id}: {e}")

if __name__ == "__main__":
    print(f"Current System Time: {time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime())} UTC")
    topics = ["0.0.8146315", "0.0.8146316", "0.0.8146317"]
    for t in topics:
        get_hcs_messages(t)
