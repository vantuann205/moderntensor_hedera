# ModernTensor Hedera Dashboard

A decentralized AI compute network dashboard built with Next.js 15, mirroring the Modernhub UI.

## Features
- **Real-time Data Proxy**: Reads JSON registry and task data directly from the backend.
- **Hedera Integration**: Live Hbar balance and transaction history tracking.
- **Network Visualization**: Canvas-based physics graph for node topology.
- **AI Task Submission**: Simulated feedback loop for compute tasks.
- **Full Explorer**: Miners, Validators, Tasks, and Emission history.

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Run Development Server**
   ```bash
   npm run dev
   ```

3. **Production Build**
   ```bash
   npm run build
   ```

## Configuration
Control the platform via `.env.local`:
- `NEXT_PUBLIC_HEDERA_ACCOUNT_ID`: Your Hedera Account ID.
- `NEXT_PUBLIC_EVM_ADDRESS`: Your EVM-compatible address.
- `NEXT_PUBLIC_MIRROR_BASE`: Mirror Node API endpoint.

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS, Shadcn UI, Framer Motion
- **Data**: TanStack React Query (Polling every 5s-20s)
- **Charts**: Recharts
- **Icons**: Lucide React
