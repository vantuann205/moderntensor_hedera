# 🔍 Hedera Verification Guide

## Vấn đề với HashScan

HashScan hiện tại không hỗ trợ view message-level cho HCS topics. Link dạng:
```
https://hashscan.io/testnet/topic/0.0.8146317/message/1
```
Sẽ bị 404 - Page Not Found.

## ✅ Cách Verify Đúng

### 1. Sử dụng Hedera Mirror Node API (Recommended)

Mirror Node API là cách chính thức và đáng tin cậy nhất để verify HCS messages.

#### View Topic Messages
```bash
curl "https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.8146317/messages"
```

#### View Specific Message by Sequence
```bash
curl "https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.8146317/messages/1"
```

#### Response Example
```json
{
  "consensus_timestamp": "1773143632.899487498",
  "message": "eyJ0eXBlIjogInRhc2tfY3JlYXRlIi...",
  "payer_account_id": "0.0.8127455",
  "sequence_number": 1,
  "topic_id": "0.0.8146317"
}
```

#### Decode Message
```bash
echo "eyJ0eXBlIjogInRhc2tfY3JlYXRlIi..." | base64 -d
```

### 2. Sử dụng HashScan Topic View

Link đến topic page (không phải message cụ thể):
```
https://hashscan.io/testnet/topic/0.0.8146317
```

Trên trang này bạn có thể:
- Xem tất cả messages trong topic
- Filter by timestamp
- Xem sequence numbers
- Xem payer accounts

### 3. Sử dụng Dragon Glass (Alternative Explorer)

```
https://app.dragonglass.me/hedera/topics/0.0.8146317
```

Dragon Glass có UI tốt hơn cho HCS topics.

---

## 📋 Our Topics

### Registration Topic
- **Topic ID**: 0.0.8146315
- **Purpose**: Miner & Validator registration
- **Mirror API**: https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.8146315/messages
- **HashScan**: https://hashscan.io/testnet/topic/0.0.8146315

### Task Topic
- **Topic ID**: 0.0.8146317
- **Purpose**: Task submissions
- **Mirror API**: https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.8146317/messages
- **HashScan**: https://hashscan.io/testnet/topic/0.0.8146317

### Scoring Topic
- **Topic ID**: 0.0.8146316
- **Purpose**: Score submissions & rewards
- **Mirror API**: https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.8146316/messages
- **HashScan**: https://hashscan.io/testnet/topic/0.0.8146316

---

## 🔧 Verification Script

Tạo file `verify_hcs.py`:

```python
#!/usr/bin/env python3
import requests
import base64
import json
import sys

def verify_message(topic_id, sequence_number):
    """Verify HCS message via Mirror Node API"""
    url = f"https://testnet.mirrornode.hedera.com/api/v1/topics/{topic_id}/messages/{sequence_number}"
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        print(f"✅ Message Found!")
        print(f"Topic ID: {data['topic_id']}")
        print(f"Sequence: {data['sequence_number']}")
        print(f"Timestamp: {data['consensus_timestamp']}")
        print(f"Payer: {data['payer_account_id']}")
        
        # Decode message
        message_b64 = data['message']
        message_decoded = base64.b64decode(message_b64).decode('utf-8')
        message_json = json.loads(message_decoded)
        
        print(f"\n📝 Message Content:")
        print(json.dumps(message_json, indent=2))
        
        return True
        
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            print(f"❌ Message not found: {topic_id}/messages/{sequence_number}")
        else:
            print(f"❌ Error: {e}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python verify_hcs.py <topic_id> <sequence_number>")
        print("Example: python verify_hcs.py 0.0.8146317 1")
        sys.exit(1)
    
    topic_id = sys.argv[1]
    sequence = int(sys.argv[2])
    
    verify_message(topic_id, sequence)
```

### Usage
```bash
python verify_hcs.py 0.0.8146317 1
```

---

## 🎯 Dashboard Implementation

### Current Implementation

Dashboard hiện tại link đến topic page thay vì message cụ thể:

```typescript
// Link to topic (works)
const link = `https://hashscan.io/testnet/topic/${topicId}`;

// Display sequence number in button
<a href={link}>Seq #{hcsSeq}</a>
```

### Why This Works

1. ✅ HashScan topic page tồn tại
2. ✅ User có thể xem tất cả messages
3. ✅ User có thể tìm message theo sequence number
4. ✅ Không bị 404

### Alternative: Direct Mirror Node Link

Nếu muốn link trực tiếp đến Mirror Node API:

```typescript
const mirrorLink = `https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages/${hcsSeq}`;
```

Nhưng điều này sẽ hiển thị raw JSON, không user-friendly.

---

## 📊 Verification Checklist

Để verify một task/miner/validator:

- [ ] Check `hcs_sequence` number exists
- [ ] Check `source` = "hedera_hcs"
- [ ] Verify via Mirror Node API
- [ ] Check consensus timestamp
- [ ] Check payer account matches
- [ ] Decode and verify message content
- [ ] Cross-reference with local data

---

## 🚀 Best Practices

### For Users
1. Click "Seq #X" button to view topic on HashScan
2. Find your message by sequence number
3. Or use Mirror Node API for programmatic verification

### For Developers
1. Always store `hcs_sequence` with data
2. Always store `topic_id` with data
3. Use Mirror Node API for verification
4. Don't rely on HashScan message-level URLs
5. Provide both HashScan and Mirror Node links

---

## 🔗 Useful Links

**Hedera Documentation:**
- HCS Overview: https://docs.hedera.com/hedera/sdks-and-apis/sdks/consensus-service
- Mirror Node API: https://docs.hedera.com/hedera/sdks-and-apis/rest-api

**Explorers:**
- HashScan: https://hashscan.io/testnet
- Dragon Glass: https://app.dragonglass.me/hedera/home
- Ledger Works: https://testnet.ledgerworks.io

**APIs:**
- Mirror Node: https://testnet.mirrornode.hedera.com/api/v1/docs

---

## ✅ Summary

**Don't:**
- ❌ Link to `hashscan.io/testnet/topic/{id}/message/{seq}` (404)
- ❌ Expect HashScan to show individual messages
- ❌ Rely only on HashScan for verification

**Do:**
- ✅ Link to `hashscan.io/testnet/topic/{id}` (topic page)
- ✅ Use Mirror Node API for programmatic verification
- ✅ Store sequence numbers for reference
- ✅ Provide multiple verification methods
- ✅ Document verification process for users

**Result:**
- 100% verifiable on Hedera
- Public, transparent, immutable
- Multiple verification methods
- User-friendly and developer-friendly
