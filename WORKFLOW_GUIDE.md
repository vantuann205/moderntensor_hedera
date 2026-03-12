# ModernTensor Protocol - Complete Workflow Guide

## 🎯 6 Luồng Chính (100% Real Data từ Hedera HCS)

### 1️⃣ Đăng ký tham gia mạng (Register as Node)

#### **Miner Registration**
**Nhiệm vụ:**
- Nhận AI/compute tasks
- Chạy model hoặc tính toán
- Trả kết quả

**Flow:**
```
Task → Miner → Compute → Submit result
```

**Cách thực hiện:**
1. Kết nối wallet (HashPack/MetaMask)
2. Click "Register as Node" trong dashboard
3. Chọn "Compute Miner"
4. Nhập stake amount (min 100 MDT)
5. Click "Deploy Miner Node"

**Kết quả:**
- Miner được đăng ký trên Hedera HCS
- Có thể tra trên HashScan: `https://hashscan.io/testnet/topic/{REGISTRATION_TOPIC_ID}/message/{sequence}`
- Xuất hiện trong danh sách Miners

---

#### **Validator Registration**
**Nhiệm vụ:**
- Kiểm tra kết quả từ miner
- Xác minh tính đúng của computation
- Gửi vote

**Flow:**
```
Miner result → Validator → Verify → Vote
```

**Cách thực hiện:**
1. Kết nối wallet
2. Click "Register as Node"
3. Chọn "Consensus Validator"
4. Nhập stake amount (min 50,000 MDT)
5. Click "Deploy Validator Node"

**Kết quả:**
- Validator được đăng ký trên Hedera HCS
- Có thể tra trên HashScan
- Xuất hiện trong danh sách Validators

---

### 2️⃣ Submit Task (Gửi Task cho Hệ Thống)

**Task types:**
- AI inference
- Data processing
- Tensor computation
- Code review

**Flow:**
```
User → Submit task → Network queue
```

**Task gồm:**
- Input data (code, text, etc.)
- Model cần chạy
- Reward amount (MDT)

**Cách thực hiện:**
1. Vào trang Tasks
2. Click "Deploy Task"
3. Nhập:
   - Code/Input data
   - Language (Solidity, Python, etc.)
   - Reward amount
   - Requester ID
4. Click "Submit Task"

**Kết quả:**
- Task được submit lên Hedera HCS Task Topic
- AI engine xử lý ngay lập tức
- Kết quả được ghi lên Hedera HCS Scoring Topic
- Có thể tra trên HashScan:
  - Task: `https://hashscan.io/testnet/topic/{TASK_TOPIC_ID}/message/{sequence}`
  - Score: `https://hashscan.io/testnet/topic/{SCORING_TOPIC_ID}/message/{sequence}`

---

### 3️⃣ Nhận Reward (Claim Rewards)

**Sau khi task hoàn thành:**
- Miner được thưởng vì compute
- Validator được thưởng vì verify

**Reward types:**
- MDT tokens
- Credit hệ thống

**Cách xem:**
1. Vào trang Rewards
2. Xem total earnings
3. Xem breakdown theo task

**Kết quả:**
- Reward được ghi trong Emissions
- Có thể tra transaction trên HashScan

---

### 4️⃣ Xem Kết Quả Task (View Task Results)

**User có thể:**
- Truy vấn kết quả
- Kiểm tra trạng thái task
- Lấy output

**Flow:**
```
Query task → Return result
```

**Cách thực hiện:**
1. Vào trang Tasks
2. Click vào task ID
3. Xem:
   - Status (pending/in_progress/completed)
   - Assigned miner
   - Score
   - Result output
   - HashScan link

**Kết quả:**
- Xem được full result từ AI engine
- Xem được score từ validator
- Link trực tiếp đến HashScan

---

### 5️⃣ Kiểm Chứng Kết Quả trên Blockchain (Verify on Hedera)

**Vì hệ thống dùng Hedera:**
- Hash kết quả được ghi lên chain
- User có thể verify

**Flow:**
```
Result hash → Hedera transaction → HashScan verification
```

**Cách kiểm chứng:**
1. Mở task detail
2. Click "Hashscan" button
3. Xem message trên Hedera HCS:
   - Consensus timestamp
   - Payer account
   - Message content (JSON)
   - Sequence number

**Kết quả:**
- 100% transparent
- Immutable record
- Public verification

---

### 6️⃣ Theo Dõi Trạng Thái Network (Monitor Network)

**User có thể xem:**
- Task queue
- Miner activity
- Validator votes
- Transaction history

**Các trang:**

#### **Dashboard (Home)**
- Network stats
- Recent transactions
- Activity feed
- Protocol infrastructure

#### **Miners Page**
- List all miners
- Stake amounts
- Trust scores
- Tasks completed

#### **Validators Page**
- List all validators
- Stake amounts
- Emissions earned
- Subnet participation

#### **Tasks Page**
- All tasks
- Status filter
- Reward amounts
- HashScan links

#### **Network Page**
- Network graph
- Node connections
- Subnet topology

#### **Rewards Page**
- Emission schedule
- Distribution history
- Miner earnings
- Validator earnings

---

## 🔧 Technical Implementation

### Data Flow

```
User Action → Dashboard UI → Next.js API → Python SDK → Hedera HCS → Mirror Node → Dashboard UI
```

### Key Files

**Backend:**
- `sdk/hedera/client.py` - Hedera client
- `sdk/hedera/hcs.py` - HCS service
- `api_inference.py` - AI inference + HCS submit
- `sync_real_data.py` - Sync from Hedera Mirror Node

**Frontend:**
- `dashboard-ui/src/app/api/register/route.ts` - Register API
- `dashboard-ui/src/app/api/tasks/submit/route.ts` - Submit task API
- `dashboard-ui/src/app/api/tasks/route.ts` - Get tasks API
- `dashboard-ui/src/app/api/miners/route.ts` - Get miners API
- `dashboard-ui/src/app/api/validators/route.ts` - Get validators API

### Environment Variables

```env
# Hedera Configuration
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.XXXXXXX
HEDERA_PRIVATE_KEY=302e...

# HCS Topics
HEDERA_REGISTRATION_TOPIC_ID=0.0.XXXXXXX
HEDERA_SCORING_TOPIC_ID=0.0.XXXXXXX
HEDERA_TASK_TOPIC_ID=0.0.XXXXXXX

# HTS Token
HEDERA_MDT_TOKEN_ID=0.0.XXXXXXX
```

---

## 🚀 Quick Start

### 1. Clear Fake Data
```bash
python clear_fake_data.py
```

### 2. Sync Real Data from Hedera
```bash
python sync_real_data.py
```

### 3. Start Dashboard
```bash
cd dashboard-ui
npm run dev
```

### 4. Register as Miner/Validator
- Open http://localhost:3000
- Connect wallet
- Click "Register as Node"

### 5. Submit Task
- Go to Tasks page
- Click "Deploy Task"
- Enter code and reward
- Submit

### 6. Verify on HashScan
- Click "Hashscan" link on any task
- View on https://hashscan.io/testnet

---

## ✅ Data Verification Checklist

- [ ] All miners có `hcs_sequence` number
- [ ] All validators có `hcs_sequence` number
- [ ] All tasks có `hcs_sequence` number
- [ ] All scores có `hcs_sequence` number
- [ ] HashScan links work và hiển thị đúng message
- [ ] Không có mock data trong `data/` folder
- [ ] Tất cả data đều có `source: "hedera_hcs"`

---

## 🔗 HashScan Links Format

**Registration:**
```
https://hashscan.io/testnet/topic/{REGISTRATION_TOPIC_ID}/message/{sequence}
```

**Tasks:**
```
https://hashscan.io/testnet/topic/{TASK_TOPIC_ID}/message/{sequence}
```

**Scores:**
```
https://hashscan.io/testnet/topic/{SCORING_TOPIC_ID}/message/{sequence}
```

---

## 📊 Data Structure

### Miner Registry
```json
{
  "miners": {
    "0.0.XXXXX": {
      "miner_id": "0.0.XXXXX",
      "stake_amount": 1000,
      "hcs_sequence": 123,
      "source": "hedera_hcs"
    }
  }
}
```

### Task Manager
```json
{
  "tasks": {
    "task-xxx": {
      "task_id": "task-xxx",
      "reward_amount": 100,
      "hcs_sequence": 456,
      "source": "hedera_hcs"
    }
  }
}
```

---

## 🎉 Success Criteria

✅ **100% Real Data** - Không có mock data
✅ **HashScan Verified** - Mọi transaction đều có thể tra được
✅ **Transparent** - Public verification
✅ **Immutable** - Blockchain record
✅ **Decentralized** - Hedera HCS consensus

---

## 🆘 Troubleshooting

**Problem:** Tasks không hiển thị HashScan link
**Solution:** Check `hcs_sequence` trong task data, run `sync_real_data.py`

**Problem:** Miners không xuất hiện sau register
**Solution:** Wait 10s for Mirror Node, then run `sync_real_data.py`

**Problem:** HashScan link 404
**Solution:** Verify topic ID trong `.env` file

---

## 📝 Notes

- Mirror Node có delay ~5-10 giây
- Luôn chạy `sync_real_data.py` sau khi submit data
- HashScan links chỉ work với data có `hcs_sequence`
- Testnet data có thể bị reset, backup topic IDs
