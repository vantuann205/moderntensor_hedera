FROM node:20-slim AS node_base

# ── Stage 1: Build Next.js ────────────────────────────────────────────────────
WORKDIR /app/dashboard-ui
COPY dashboard-ui/package*.json ./
RUN npm ci
COPY dashboard-ui/ ./
# Build will use env vars injected at runtime via Railway
RUN npm run build

# ── Stage 2: Final image with Python + Node ───────────────────────────────────
FROM python:3.12-slim

# Install Node.js 20
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Python deps and install
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy SDK and scripts
COPY sdk/ ./sdk/
COPY scripts/ ./scripts/
COPY .env* ./

# Copy built Next.js app
COPY --from=node_base /app/dashboard-ui ./dashboard-ui
COPY --from=node_base /app/dashboard-ui/node_modules ./dashboard-ui/node_modules

# Set Python path for API routes
ENV PYTHON_PATH=/usr/local/bin/python3
ENV PYTHONIOENCODING=utf-8
ENV NODE_ENV=production

WORKDIR /app/dashboard-ui

EXPOSE 3000

CMD ["node_modules/.bin/next", "start", "-p", "3000"]
