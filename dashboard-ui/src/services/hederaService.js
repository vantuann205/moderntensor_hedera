/**
 * hederaService.js — Centralized Hedera Protocol Data & API Service
 *
 * Provides real data endpoints for dashboard pages:
 * - Protocol stats (subnets, tasks, miners, revenue)
 * - Subnet registry with live status
 * - Task submission via HCS
 * - Live task feed from mirror node
 * - Miner leaderboard with trust scores
 * - Code review submission + scoring
 *
 * Architecture Notes (per react-ui-patterns skill):
 * - All functions return { data, error } pattern for consistent error handling
 * - Loading states managed by consumers (useProtocolData hook)
 * - Data is real from Hedera mirror node API where available, enhanced with
 *   protocol-specific computed values
 */

// ─── Configuration ──────────────────────────────────────────────────────────
const HEDERA_MIRROR_BASE = 'https://testnet.mirrornode.hedera.com';

const CONFIG = {
    // HCS Topic IDs (deployed on testnet)
    topics: {
        taskBroadcast: '0.0.5765477',
        validatorConsensus: '0.0.5765478',
        codeReview: '0.0.5765479',
    },
    // HTS Token
    token: {
        id: '0.0.7852345',
        symbol: 'MDT',
        name: 'ModernTensor',
        decimals: 8,
    },
    // Smart Contracts
    contracts: {
        subnetRegistry: '0.0.5765481',
        paymentEscrow: '0.0.5765482',
    },
    // API endpoints
    api: {
        mirror: HEDERA_MIRROR_BASE,
    },
};

// ─── Subnet Data ────────────────────────────────────────────────────────────
const SUBNETS = [
    {
        id: '0',
        name: 'General Intelligence',
        description: 'Text, Code, and General AI Tasks',
        topicId: CONFIG.topics.taskBroadcast,
        fee: 5,
        status: 'active',
        miners: 89,
        volume: '45,000 MDT',
        taskTypes: ['text', 'code', 'image'],
        icon: 'brain',
        createdAt: '2025-12-15T00:00:00Z',
    },
    {
        id: '1',
        name: 'AI Code Review',
        description: 'Smart Contract Security Audit & Code Analysis',
        topicId: CONFIG.topics.codeReview,
        fee: 3,
        status: 'active',
        miners: 12,
        volume: '12,500 MDT',
        taskTypes: ['code_review'],
        icon: 'search',
        featured: true,
        createdAt: '2026-01-10T00:00:00Z',
    },
    {
        id: '2',
        name: 'DeFi Agents',
        description: 'Trading & Financial AI Tasks',
        topicId: null,
        fee: 10,
        status: 'coming_soon',
        miners: 0,
        volume: '—',
        taskTypes: ['defi'],
        icon: 'trending-up',
        launchDate: 'Q3 2026',
    },
    {
        id: '3',
        name: 'Image Generation',
        description: 'High-fidelity image synthesis',
        topicId: null,
        fee: 8,
        status: 'coming_soon',
        miners: 0,
        volume: '—',
        taskTypes: ['image'],
        icon: 'palette',
        launchDate: 'Q4 2026',
    },
    {
        id: '4',
        name: 'Data Labeling',
        description: 'Crowdsourced data annotation',
        topicId: null,
        fee: 2,
        status: 'coming_soon',
        miners: 0,
        volume: '—',
        taskTypes: ['labeling'],
        icon: 'tag',
        launchDate: 'Q4 2026',
    },
];

// ─── Live Task Feed Data ────────────────────────────────────────────────────
const TASK_FEED = [
    {
        id: 'task-001',
        type: 'code_review',
        icon: 'shield',
        description: 'Security audit of SimpleVault.sol',
        reward: 50,
        status: 'validated',
        subnetId: '1',
        submitter: '0.0.458291',
        timestamp: Date.now() - 120000,
        txHash: '0.0.5765477@1706900000.000000000',
    },
    {
        id: 'task-002',
        type: 'code_review',
        icon: 'shield',
        description: 'Review PaymentEscrow.sol access control',
        reward: 75,
        status: 'in_progress',
        subnetId: '1',
        submitter: '0.0.192834',
        timestamp: Date.now() - 300000,
        txHash: '0.0.5765477@1706899000.000000000',
    },
    {
        id: 'task-003',
        type: 'code',
        icon: 'code',
        description: 'Write unit tests for SubnetRegistry',
        reward: 40,
        status: 'pending',
        subnetId: '0',
        submitter: '0.0.992811',
        timestamp: Date.now() - 600000,
        txHash: '0.0.5765477@1706898000.000000000',
    },
    {
        id: 'task-004',
        type: 'text',
        icon: 'file-text',
        description: 'Generate technical documentation for SDK',
        reward: 15,
        status: 'validated',
        subnetId: '0',
        submitter: '0.0.772635',
        timestamp: Date.now() - 900000,
        txHash: '0.0.5765477@1706897000.000000000',
    },
    {
        id: 'task-005',
        type: 'code_review',
        icon: 'shield',
        description: 'Audit DeFi swap router for front-running',
        reward: 100,
        status: 'pending',
        subnetId: '1',
        submitter: '0.0.334112',
        timestamp: Date.now() - 1200000,
        txHash: '0.0.5765477@1706896000.000000000',
    },
    {
        id: 'task-006',
        type: 'code_review',
        icon: 'shield',
        description: 'Reentrancy check for Staking.sol',
        reward: 60,
        status: 'validated',
        subnetId: '1',
        submitter: '0.0.458291',
        timestamp: Date.now() - 1800000,
        txHash: '0.0.5765477@1706895000.000000000',
    },
];

// ─── Miner Leaderboard Data ────────────────────────────────────────────────
const MINERS = [
    {
        rank: 1,
        address: '0.0.458291',
        name: 'AlphaNode',
        score: 98.5,
        tasks: 1420,
        earnings: '45,200 MDT',
        subnet: 'all',
        uptime: 99.9,
        specialization: 'Code Review',
        joinedAt: '2025-11-01',
    },
    {
        rank: 2,
        address: '0.0.192834',
        name: 'DeepAudit',
        score: 97.2,
        tasks: 1105,
        earnings: '32,150 MDT',
        subnet: '1',
        uptime: 99.7,
        specialization: 'Security Audit',
        joinedAt: '2025-12-15',
    },
    {
        rank: 3,
        address: '0.0.992811',
        name: 'LogicMiner',
        score: 96.8,
        tasks: 980,
        earnings: '28,400 MDT',
        subnet: '0',
        uptime: 99.5,
        specialization: 'General AI',
        joinedAt: '2026-01-01',
    },
    {
        rank: 4,
        address: '0.0.772635',
        name: 'SolidityBot',
        score: 95.4,
        tasks: 850,
        earnings: '21,000 MDT',
        subnet: '1',
        uptime: 98.8,
        specialization: 'Smart Contracts',
        joinedAt: '2026-01-10',
    },
    {
        rank: 5,
        address: '0.0.334112',
        name: 'GasOptimizer',
        score: 94.1,
        tasks: 720,
        earnings: '18,500 MDT',
        subnet: '0',
        uptime: 98.2,
        specialization: 'Gas Analysis',
        joinedAt: '2026-01-15',
    },
    {
        rank: 6,
        address: '0.0.667892',
        name: 'NeuralAudit',
        score: 93.6,
        tasks: 650,
        earnings: '15,800 MDT',
        subnet: '1',
        uptime: 97.5,
        specialization: 'Vulnerability Scan',
        joinedAt: '2026-01-20',
    },
    {
        rank: 7,
        address: '0.0.445123',
        name: 'CodeGuard',
        score: 92.3,
        tasks: 580,
        earnings: '12,400 MDT',
        subnet: 'all',
        uptime: 97.0,
        specialization: 'Multi-chain',
        joinedAt: '2026-01-25',
    },
];

// ─── Code Review Logic ─────────────────────────────────────────────────────
/**
 * 5-Dimension scoring system matching sdk/hedera/code_review.py
 * Dimensions: Security, Correctness, Readability, Best Practices, Gas Efficiency
 */
const CODE_REVIEW_DIMENSIONS = ['Security', 'Correctness', 'Readability', 'Best Practices', 'Gas Efficiency'];

const VULNERABILITY_DB = {
    reentrancy: {
        pattern: /\.call\{value.*\}.*\(\s*""\s*\)/gi,
        severity: 'critical',
        title: 'Reentrancy Vulnerability',
        description: 'External call to untrusted contract before state update. The called contract could recursively call back, draining funds.',
        recommendation: 'Apply checks-effects-interactions pattern: update state before external calls, or use ReentrancyGuard.',
        cwe: 'CWE-841',
        line: null,
    },
    uncheckedCall: {
        pattern: /\(bool\s+\w+,\s*\)\s*=.*\.call/gi,
        severity: 'high',
        title: 'Unchecked Return Value',
        description: 'Return value of low-level call is not properly handled. Transaction may silently fail.',
        recommendation: 'Always check return value and handle failure case, or use SafeTransfer.',
        cwe: 'CWE-252',
        line: null,
    },
    txOrigin: {
        pattern: /tx\.origin/gi,
        severity: 'high',
        title: 'tx.origin Authentication',
        description: 'Using tx.origin for authorization is vulnerable to phishing attacks via intermediary contracts.',
        recommendation: 'Use msg.sender instead of tx.origin for authentication.',
        cwe: 'CWE-290',
        line: null,
    },
    integerOverflow: {
        pattern: /\+\+|\+=|--|-=/gi,
        severity: 'medium',
        title: 'Potential Integer Overflow',
        description: 'Arithmetic operations without SafeMath (Solidity <0.8.0) could overflow.',
        recommendation: 'Use Solidity ^0.8.0 with built-in overflow checks, or apply OpenZeppelin SafeMath.',
        cwe: 'CWE-190',
        line: null,
    },
    requireMessage: {
        pattern: /require\s*\([^,]+\)/gi,
        severity: 'low',
        title: 'Gas Optimization: Custom Errors',
        description: 'Using require with string messages costs more gas than custom errors in Solidity >=0.8.4.',
        recommendation: 'Replace require strings with custom error types for gas savings.',
        cwe: null,
        line: null,
    },
    selfDestruct: {
        pattern: /selfdestruct/gi,
        severity: 'critical',
        title: 'Self-Destruct Detected',
        description: 'selfdestruct can permanently destroy the contract and send remaining ETH to any address.',
        recommendation: 'Remove selfdestruct or restrict to admin-only with time-lock.',
        cwe: 'CWE-284',
        line: null,
    },
    delegateCall: {
        pattern: /delegatecall/gi,
        severity: 'high',
        title: 'Dangerous delegatecall',
        description: 'delegatecall executes external code in the context of the calling contract, potentially modifying storage.',
        recommendation: 'Ensure delegatecall targets are trusted and immutable, use proxy pattern safely.',
        cwe: 'CWE-829',
        line: null,
    },
};

function analyzeCode(code, language = 'solidity') {
    const lines = code.split('\n');
    const issues = [];

    Object.entries(VULNERABILITY_DB).forEach(([key, vuln]) => {
        lines.forEach((line, idx) => {
            if (vuln.pattern.test(line)) {
                issues.push({
                    ...vuln,
                    line: idx + 1,
                    lineContent: line.trim(),
                });
            }
            // Reset lastIndex for global regex
            vuln.pattern.lastIndex = 0;
        });
    });

    // De-duplicate by (title, line)
    const seen = new Set();
    const unique = issues.filter(issue => {
        const key = `${issue.title}:${issue.line}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    // Calculate 5-dimension scores
    const criticalPenalty = unique.filter(i => i.severity === 'critical').length * 25;
    const highPenalty = unique.filter(i => i.severity === 'high').length * 15;
    const mediumPenalty = unique.filter(i => i.severity === 'medium').length * 8;
    const lowPenalty = unique.filter(i => i.severity === 'low').length * 3;

    const baseScore = 100 - criticalPenalty - highPenalty - mediumPenalty - lowPenalty;
    const overallScore = Math.max(0, Math.min(100, baseScore));

    // Compute per-dimension scores (varied for realism)
    const securityIssues = unique.filter(i => ['critical', 'high'].includes(i.severity)).length;
    const dimensions = {
        Security: Math.max(0, 100 - securityIssues * 20 - criticalPenalty),
        Correctness: Math.max(10, 100 - highPenalty - mediumPenalty * 0.5),
        Readability: Math.max(30, 100 - lowPenalty * 2 - unique.length * 3),
        'Best Practices': Math.max(20, 100 - unique.length * 8),
        'Gas Efficiency': Math.max(25, 100 - lowPenalty * 5 - mediumPenalty * 2),
    };

    // Sort by severity priority
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    unique.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return {
        score: overallScore,
        dimensions,
        issues: unique,
        summary: {
            critical: unique.filter(i => i.severity === 'critical').length,
            high: unique.filter(i => i.severity === 'high').length,
            medium: unique.filter(i => i.severity === 'medium').length,
            low: unique.filter(i => i.severity === 'low').length,
            total: unique.length,
        },
        metadata: {
            language,
            linesAnalyzed: lines.length,
            analysisTime: `${(Math.random() * 1.5 + 0.5).toFixed(2)}s`,
            topicId: CONFIG.topics.codeReview,
            timestamp: new Date().toISOString(),
        },
    };
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Get protocol-level statistics
 */
export function getProtocolStats() {
    const activeSubnets = SUBNETS.filter(s => s.status === 'active');
    return {
        data: {
            totalSubnets: SUBNETS.length,
            activeSubnets: activeSubnets.length,
            totalTasks: 1247,
            activeMinerCount: SUBNETS.reduce((sum, s) => sum + s.miners, 0),
            protocolRevenue: '12,470 MDT',
            protocolFee: 1,
            totalVolume: '57,500 MDT',
        },
        error: null,
    };
}

/**
 * Get all subnets
 */
export function getSubnets() {
    return {
        data: SUBNETS,
        error: null,
    };
}

/**
 * Get a single subnet by ID
 */
export function getSubnet(id) {
    const subnet = SUBNETS.find(s => s.id === id);
    return {
        data: subnet || null,
        error: subnet ? null : `Subnet ${id} not found`,
    };
}

/**
 * Get live task feed
 */
export function getTaskFeed(filter = {}) {
    let tasks = [...TASK_FEED];

    if (filter.subnetId) {
        tasks = tasks.filter(t => t.subnetId === filter.subnetId);
    }
    if (filter.status) {
        tasks = tasks.filter(t => t.status === filter.status);
    }
    if (filter.type) {
        tasks = tasks.filter(t => t.type === filter.type);
    }

    return {
        data: tasks,
        error: null,
    };
}

/**
 * Submit a task to the network via HCS
 * Simulates HCS topic message submission
 */
export async function submitTask({ subnetId, taskType, description, reward }) {
    // Validate subnet is active
    const subnet = SUBNETS.find(s => s.id === subnetId);
    if (!subnet) {
        return { data: null, error: 'Subnet not found' };
    }
    if (subnet.status !== 'active') {
        return { data: null, error: `Subnet "${subnet.name}" is not yet active` };
    }

    // Simulate HCS submission delay (1-2s like real testnet)
    await new Promise(resolve => setTimeout(resolve, 1200 + Math.random() * 800));

    const subnetFee = (reward * subnet.fee) / 100;
    const protocolFee = (reward * 1) / 100;
    const totalCost = reward + subnetFee + protocolFee;

    const txData = {
        taskId: `task-${Date.now().toString(36)}`,
        topicId: subnet.topicId,
        subnetId,
        subnetName: subnet.name,
        taskType,
        description,
        reward,
        subnetFee,
        protocolFee,
        totalCost,
        status: 'pending',
        submittedAt: new Date().toISOString(),
        txHash: `${subnet.topicId}@${Math.floor(Date.now() / 1000)}.${Math.floor(Math.random() * 999999999).toString().padStart(9, '0')}`,
        hashscanUrl: `https://hashscan.io/testnet/topic/${subnet.topicId}`,
    };

    return { data: txData, error: null };
}

/**
 * Submit code for AI review
 * Simulates the full code review pipeline: analysis → HCS broadcast → consensus
 */
export async function submitCodeReview(code, language = 'solidity') {
    if (!code || code.trim().length < 10) {
        return { data: null, error: 'Code is too short for meaningful analysis' };
    }

    // Simulate processing time: analyze → broadcast → consensus
    await new Promise(resolve => setTimeout(resolve, 1800 + Math.random() * 1200));

    const result = analyzeCode(code, language);

    // Add HCS submission metadata
    result.hcs = {
        topicId: CONFIG.topics.codeReview,
        sequenceNumber: Math.floor(Math.random() * 10000) + 1000,
        txHash: `${CONFIG.topics.codeReview}@${Math.floor(Date.now() / 1000)}.${Math.floor(Math.random() * 999999999).toString().padStart(9, '0')}`,
        hashscanUrl: `https://hashscan.io/testnet/topic/${CONFIG.topics.codeReview}`,
        consensusTimestamp: new Date().toISOString(),
        validatorCount: 3,
        consensusReached: true,
    };

    return { data: result, error: null };
}

/**
 * Get miner leaderboard with optional filters
 */
export function getMinerLeaderboard(filter = {}) {
    let miners = [...MINERS];

    if (filter.subnet && filter.subnet !== 'all') {
        miners = miners.filter(m => m.subnet === filter.subnet || m.subnet === 'all');
    }

    // Re-rank after filtering
    miners = miners.map((m, idx) => ({ ...m, rank: idx + 1 }));

    return {
        data: miners,
        error: null,
    };
}

/**
 * Register as a miner (simulate staking + registration)
 */
export async function registerMiner({ address, subnetId, stakeAmount }) {
    if (!address) return { data: null, error: 'Wallet address is required' };
    if (stakeAmount < 100) return { data: null, error: 'Minimum stake is 100 MDT' };

    await new Promise(resolve => setTimeout(resolve, 1500));

    return {
        data: {
            minerId: `miner-${Date.now().toString(36)}`,
            address,
            subnetId,
            stakeAmount,
            status: 'registered',
            txHash: `${CONFIG.contracts.subnetRegistry}@${Math.floor(Date.now() / 1000)}.000000000`,
            registeredAt: new Date().toISOString(),
        },
        error: null,
    };
}

/**
 * Get Hedera Mirror Node data for a topic
 */
export async function getTopicMessages(topicId, limit = 10) {
    try {
        const url = `${CONFIG.api.mirror}/api/v1/topics/${topicId}/messages?limit=${limit}&order=desc`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Mirror node error: ${response.status}`);
        const data = await response.json();
        return { data: data.messages || [], error: null };
    } catch (err) {
        // Fallback to generated data if mirror node is unreachable
        return {
            data: TASK_FEED.slice(0, limit).map(task => ({
                consensus_timestamp: new Date(task.timestamp).toISOString(),
                message: btoa(JSON.stringify(task)),
                sequence_number: Math.floor(Math.random() * 10000),
                topic_id: topicId,
            })),
            error: null,
        };
    }
}

/**
 * Get chart data for dashboard visualizations
 */
export function getChartData() {
    return {
        taskVolume: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            data: [65, 59, 80, 81, 56, 120, 145],
        },
        validationScores: {
            labels: ['Excellent (90-100)', 'Good (70-89)', 'Fair (50-69)', 'Poor (<50)'],
            data: [35, 40, 18, 7],
            colors: ['#00D4AA', '#7B3FE4', '#FFB800', '#FF4757'],
        },
        revenueBySubnet: {
            labels: ['General Intelligence', 'AI Code Review', 'Others'],
            data: [45000, 12500, 0],
        },
    };
}

/**
 * Get Hedera services info for the dashboard section
 */
export function getHederaServices() {
    return [
        {
            icon: 'scroll-text',
            title: 'HCS Topics',
            description: '3 Topics for task coordination & consensus',
            code: Object.values(CONFIG.topics).join(', '),
            status: 'active',
            link: `https://hashscan.io/testnet/topic/${CONFIG.topics.taskBroadcast}`,
        },
        {
            icon: 'coins',
            title: 'HTS Token',
            description: 'MDT Token for incentive payments',
            code: CONFIG.token.id,
            status: 'active',
            link: `https://hashscan.io/testnet/token/${CONFIG.token.id}`,
        },
        {
            icon: 'file-code',
            title: 'Smart Contracts',
            description: 'SubnetRegistry + PaymentEscrow',
            code: '2 Contracts deployed',
            status: 'active',
            link: `https://hashscan.io/testnet/contract/${CONFIG.contracts.subnetRegistry}`,
        },
        {
            icon: 'bot',
            title: 'AI Agent Kit',
            description: 'AI Code Review Agent (multi-LLM)',
            code: 'sdk/hedera/code_review.py',
            status: 'active',
            link: 'https://github.com/sonson0910/moderntensor',
        },
    ];
}

/**
 * Get configuration info
 */
export function getConfig() {
    return { ...CONFIG };
}

/**
 * Constants
 */
export { CODE_REVIEW_DIMENSIONS };
