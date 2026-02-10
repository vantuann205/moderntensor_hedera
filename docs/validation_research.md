# Validation Research: How to Verify AI Quality in a Decentralized Network

## Vấn đề hiện tại của ModernTensor

Hiện tại validation dùng `MultiDimensionScorer` — **1 AI chấm điểm output của AI khác**. Có 3 lỗ hổng nghiêm trọng:

| Lỗ hổng | Tấn công | Hậu quả |
|---------|---------|---------|
| AI chấm AI | Scorer có bias → chấm sai | Winner sai |
| 1 validator | Validator gian lận → thiên vị | Miner tốt bị loại |
| Không ground truth | Không biết đáp án đúng | Không có cách xác minh |

---

## 5 Cách các dự án lớn giải quyết

### 1. Bittensor — Yuma Consensus

```
Nhiều validator → mỗi validator chấm score riêng → gửi on-chain
                          ↓
              Yuma Consensus tổng hợp:
              • Loại validator chấm quá khác biệt (clipping)
              • Validator có stake cao → ảnh hưởng lớn hơn
              • vtrust: validator chấm giống đa số → được thưởng nhiều
              • Commit-reveal: validator không thể copy score người khác
```

**Key insight:** Không ai biết đáp án đúng. Thay vào đó, validator **đặt cược tiền** vào score → sai thì mất tiền. Kết hợp nhiều validator → hội tụ dần về đáp án đúng.

---

### 2. Numerai — Stake-and-Burn trên kết quả thực

```
Miner submit dự đoán
    → Stake NMR token vào dự đoán đó
    → Đợi kết quả thực tế (live data)
    → Đúng: nhận thưởng
    → Sai: bị burn stake
```

**Key insight:** Validation bằng **thực tế**. Không cần AI chấm AI — đợi kết quả real-world rồi so sánh. Áp dụng được khi task có kết quả kiểm chứng được (VD: code chạy được hay không).

---

### 3. Proof of Quality (PoQ) — BERT Cross-encoder

```
Miner chạy model lớn (GPT, Llama) → sinh output
    ↓
Validator chạy model NHỎ, nhẹ (BERT cross-encoder) → chấm quality
    ↓
Score on-chain, consensus trong milliseconds
```

**Key insight:** Dùng **model nhỏ chuyên chấm điểm** (cross-encoder) thay vì chạy lại model lớn. Nhẹ, nhanh, chạy được trên CPU. Paper chứng minh robust chống adversarial.

---

### 4. Ritual — Proof-of-Inference (ZKP + TEE)

```
Miner chạy inference trong TEE (Intel SGX / AWS Nitro)
    → TEE tạo attestation: "model X, input Y, output Z"
    → On-chain có thể verify attestation mà không cần chạy lại
```

**Key insight:** Không chấm **chất lượng** output, mà chứng minh **inference đã chạy đúng model**. Hardware-based trust.

---

### 5. OPML — Optimistic Fraud Proof

```
Miner submit kết quả → chấp nhận mặc định (optimistic)
    ↓
Challenge window (7 ngày): ai cũng có thể dispute
    ↓
Nếu dispute: bisection protocol → tìm đúng 1 bước sai
    ↓
On-chain arbitrate bước đó → phạt bên sai
```

**Key insight:** Không verify mọi kết quả — chỉ verify khi bị challenge. Rẻ, scalable. Chỉ cần **1 honest challenger** là đủ.

---

## Đề xuất cho ModernTensor — 3 lớp validation

```
┌─────────────────────────────────────────────┐
│         LAYER 3: Benchmark Challenges       │  ← Ground truth
│  Xen test challenge (đáp án biết trước)     │
│  vào giữa task thật. Miner không biết.      │
│  Score = so sánh với đáp án.                │
├─────────────────────────────────────────────┤
│         LAYER 2: Proof of Quality (PoQ)     │  ← AI chấm AI, nhưng đúng
│  Lightweight scorer (cross-encoder) chấm    │
│  semantic quality. Nhiều validator chấm     │
│  độc lập → Yuma-style consensus.            │
├─────────────────────────────────────────────┤
│         LAYER 1: Proof of Intelligence      │  ← Anti-cheat cơ bản
│  Detection: output rỗng, copy, quá ngắn,   │
│  collusion. Đã có sẵn.                     │
└─────────────────────────────────────────────┘
```

### Layer 1: PoI (đã có ✅)
- Phát hiện output rỗng, copy-paste, collusion
- Gate cơ bản — loại miner gian lận rõ ràng

### Layer 2: PoQ — Proof of Quality (cần thêm)
- Dùng cross-encoder model nhẹ chấm semantic similarity
- Nhiều validator chấm độc lập → loại outlier (Yuma-style clipping)
- Validator stake token → sai thì mất → incentive chấm đúng

### Layer 3: Benchmark Challenges (cần thêm)
- Pool code mẫu có lỗi đã biết (từ SWC, CWE)
- Xen vào giữa task thật — miner không phân biệt được
- Score = % lỗi phát hiện đúng
- Cập nhật trực tiếp reputation, dùng để calibrate Layer 2

---

## Áp dụng cho Hackathon

> [!IMPORTANT]
> Không cần implement tất cả. Thêm **Layer 3 (Benchmark Challenges)** là đủ thuyết phục — vì nó chứng minh quality bằng ground truth, không phải "AI tự chấm AI".

### Scope hackathon:

| Layer | Implement? | Lý do |
|-------|-----------|-------|
| Layer 1 (PoI) | ✅ Đã có | Anti-cheat cơ bản |
| Layer 2 (PoQ) | 🟡 Mention trong pitch | Cần BERT model, phức tạp |
| Layer 3 (Benchmark) | ✅ **Nên thêm** | Code đơn giản, demo tốt, thuyết phục |

### Benchmark Challenge flow:

```python
# Pseudocode
class BenchmarkPool:
    challenges = [
        {
            "code": "contract with reentrancy...",
            "known_bugs": ["reentrancy", "no-access-control"],
            "severities": ["high", "medium"],
        },
        # ... more challenges from SWC database
    ]

    def inject_challenge(self, miner_id):
        """Gửi 1 challenge như task thật cho miner."""
        challenge = random.choice(self.challenges)
        # Miner nhận và xử lý như task thường
        return challenge

    def score_response(self, response, ground_truth):
        """So sánh output miner với đáp án đã biết."""
        found_bugs = extract_bugs(response)
        correct = set(found_bugs) & set(ground_truth["known_bugs"])
        return len(correct) / len(ground_truth["known_bugs"])
```
