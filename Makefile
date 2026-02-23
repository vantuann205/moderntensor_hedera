# ModernTensor Makefile
# "The Trust Layer for AI Agents" - Hedera Hello Future Apex 2026

.PHONY: all install demo test ui clean check

# Default target
all: install test

# 1. Setup & Installation
install:
	@echo "📦 Installing Python dependencies..."
	pip install -r requirements.txt
	@echo "📦 Installing Dashboard dependencies..."
	cd dashboard-ui && npm install
	@echo "✅ Ready! Copy .env.example to .env and configure credentials."

# 2. Run the Main Demo (Subnet Lifecycle)
demo:
	@echo "🚀 Running ModernTensor Subnet Demo..."
	python3 demo_subnet.py

# 3. Run Validation Tests (87/87 Passing)
test:
	@echo "🧪 Running Test Suite..."
	python3 -m pytest tests/ -v --tb=short

# 4. Launch Dashboard UI
ui:
	@echo "🎨 Starting Dashboard..."
	cd dashboard-ui && npm run dev

# 5. Linting / Checking (for CI)
check:
	python3 -m pytest tests/ --dry-run
	git status

clean:
	rm -rf __pycache__
	rm -rf */__pycache__
	rm -rf .pytest_cache
	find . -name "*.pyc" -delete
