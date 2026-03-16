FROM node:20-slim AS node_base

# ── Stage 1: Build Next.js ────────────────────────────────────────────────────
WORKDIR /app/dashboard-ui
COPY dashboard-ui/package*.json ./
RUN npm ci
COPY dashboard-ui/ ./
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

# Copy standalone Next.js build (much smaller than full node_modules)
COPY --from=node_base /app/dashboard-ui/.next/standalone ./dashboard-ui/
COPY --from=node_base /app/dashboard-ui/.next/static ./dashboard-ui/.next/static
COPY --from=node_base /app/dashboard-ui/public ./dashboard-ui/public

# Set Python path for API routes
ENV PYTHON_PATH=/usr/local/bin/python3
ENV PYTHONIOENCODING=utf-8
ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app/dashboard-ui

EXPOSE 3000

CMD ["node", "server.js"]
