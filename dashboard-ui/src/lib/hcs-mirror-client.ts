// Use Hedera Mirror Node REST API to fetch HCS messages
// More reliable than SDK in Next.js environment

export interface MinerRegistration {
  type: 'miner_registration';
  minerId: string;
  accountId?: string;
  subnetIds: number[];
  stakeAmount: number;
  capabilities: string[];
  timestamp: number;
  consensusTimestamp?: string;
  sequenceNumber?: number;
}

export interface ScoreSubmission {
  type: 'score_submission';
  taskId: string;
  minerId: string;
  validatorId: string;
  score: number;
  confidence: number;
  metrics?: {
    relevance?: number;
    quality?: number;
    completeness?: number;
    creativity?: number;
    [key: string]: number | undefined;
  };
  dimensions?: Record<string, number>;
  timestamp: number;
  consensusTimestamp?: string;
  sequenceNumber?: number;
}

export interface TaskRequest {
  type: 'task_request';
  requestId: string;
  subnetId: number;
  requester: string;
  taskType: string;
  prompt: string;
  rewardAmount: number;
  deadline?: number;
  status: string;
  timestamp: number;
  consensusTimestamp?: string;
  sequenceNumber?: number;
}

export interface TaskSubmission {
  type: 'task_submission';
  taskId: string;
  onChainTaskId?: string | null;
  contractTs?: string | null;
  transferTs?: string | null;
  subnetId: number;
  requester: string;
  taskType: string;
  prompt: string;
  rewardAmount: number;
  deadline?: number;
  timestamp: number;
  consensusTimestamp?: string;
}

export class HCSMirrorClient {
  private mirrorNodeUrl = 'https://testnet.mirrornode.hedera.com/api/v1';

  async getTopicMessages(topicId: string, limit: number = 100): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.mirrorNodeUrl}/topics/${topicId}/messages?limit=${limit}&order=desc`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        console.error(`Mirror node error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      
      if (!data.messages || !Array.isArray(data.messages)) {
        return [];
      }

      return data.messages.map((msg: any) => {
        try {
          // Decode base64 message
          const decoded = Buffer.from(msg.message, 'base64').toString('utf8');
          const parsed = JSON.parse(decoded);
          return {
            ...parsed,
            consensusTimestamp: msg.consensus_timestamp,
            sequenceNumber: msg.sequence_number
          };
        } catch (e) {
          console.error('Error parsing message:', e);
          return null;
        }
      }).filter((m: any) => m !== null);
    } catch (error) {
      console.error('Error fetching from mirror node:', error);
      return [];
    }
  }

  async getMinerRegistrations(): Promise<MinerRegistration[]> {
    const topicId = process.env.NEXT_PUBLIC_REGISTRATION_TOPIC_ID;
    if (!topicId) {
      console.error('NEXT_PUBLIC_REGISTRATION_TOPIC_ID not set');
      return [];
    }

    try {
      const messages = await this.getTopicMessages(topicId, 100);
      console.log('Raw miner messages:', messages.length);
      
      return messages
        .filter((msg: any) => msg.type === 'miner_register')
        .map((msg: any) => ({
          type: 'miner_registration' as const,
          minerId: msg.miner_id,
          accountId: msg.account_id,
          subnetIds: msg.subnet_ids || [],
          stakeAmount: msg.stake_amount || 0,
          capabilities: msg.capabilities || [],
          timestamp: msg.timestamp || Date.now(),
          consensusTimestamp: msg.consensusTimestamp,
          sequenceNumber: msg.sequenceNumber,
        }));
    } catch (error) {
      console.error('Error fetching miner registrations:', error);
      return [];
    }
  }

  async getScoreSubmissions(): Promise<ScoreSubmission[]> {
    const topicId = process.env.NEXT_PUBLIC_SCORING_TOPIC_ID;
    if (!topicId) {
      console.error('NEXT_PUBLIC_SCORING_TOPIC_ID not set');
      return [];
    }

    try {
      const messages = await this.getTopicMessages(topicId, 200);
      console.log('Raw score messages:', messages.length);
      
      return messages
        .filter((msg: any) => msg.type === 'score_submit')
        .map((msg: any) => ({
          type: 'score_submission' as const,
          taskId: msg.task_id,
          minerId: msg.miner_id,
          validatorId: msg.validator_id,
          // score can be 0-100 (Python SDK) or 0-1 — keep raw, UI normalizes
          score: msg.score ?? 0,
          confidence: msg.confidence ?? 1,
          metrics: msg.metrics ?? {},
          dimensions: msg.metrics ?? {},
          timestamp: msg.timestamp || Date.now(),
          consensusTimestamp: msg.consensusTimestamp,
          sequenceNumber: msg.sequenceNumber,
        }));
    } catch (error) {
      console.error('Error fetching score submissions:', error);
      return [];
    }
  }

  async getTaskRequests(): Promise<TaskRequest[]> {
    const topicId = process.env.NEXT_PUBLIC_TASK_TOPIC_ID;
    if (!topicId) return [];
    try {
      const messages = await this.getTopicMessages(topicId, 100);
      return messages
        .filter((msg: any) => msg.type === 'task_request')
        .map((msg: any) => ({
          type: 'task_request' as const,
          requestId: msg.request_id,
          subnetId: msg.subnet_id ?? 0,
          requester: msg.requester_id || msg.requester || '',
          taskType: msg.task_type || 'text_generation',
          prompt: msg.prompt || '',
          rewardAmount: msg.reward_amount || 0,
          deadline: msg.deadline_hours || msg.deadline,
          status: msg.status || 'pending',
          timestamp: msg.timestamp || Date.now(),
          consensusTimestamp: msg.consensusTimestamp,
          sequenceNumber: msg.sequenceNumber,
        }));
    } catch (error) {
      console.error('Error fetching task requests:', error);
      return [];
    }
  }

  async getTaskSubmissions(): Promise<TaskSubmission[]> {
    const topicId = process.env.NEXT_PUBLIC_TASK_TOPIC_ID;
    if (!topicId) {
      console.error('NEXT_PUBLIC_TASK_TOPIC_ID not set');
      return [];
    }

    try {
      const messages = await this.getTopicMessages(topicId, 100);
      console.log('Raw task messages:', messages.length);
      
      return messages
        .filter((msg: any) => msg.type === 'task_create' || msg.type === 'task_submit')
        .map((msg: any) => {
          // reward_amount can be MDT float (new format) or raw 8-decimal int (old format)
          const rawReward = msg.reward_amount ?? 0;
          const rewardMDT = rawReward > 1e6 ? rawReward / 1e8 : rawReward;
          return {
            type: 'task_submission' as const,
            taskId: msg.task_id,
            onChainTaskId: msg.on_chain_task_id ?? null,
            contractTs: msg.contract_ts ?? null,
            transferTs: msg.transfer_ts ?? null,
            subnetId: msg.subnet_id ?? 0,
            requester: msg.requester_id || msg.requester || '',
            taskType: msg.task_type || 'text_generation',
            prompt: msg.prompt || '',
            rewardAmount: rewardMDT,  // always MDT float
            deadline: msg.deadline_hours || msg.deadline,
            timestamp: msg.timestamp || Date.now(),
            consensusTimestamp: msg.consensusTimestamp,
            sequenceNumber: msg.sequenceNumber,
          };
        });
    } catch (error) {
      console.error('Error fetching task submissions:', error);
      return [];
    }
  }
}

export const hcsMirrorClient = new HCSMirrorClient();
