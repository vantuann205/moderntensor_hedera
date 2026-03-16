// HCS Client to read real data from Hedera Consensus Service
import { Client, TopicMessageQuery, AccountId, PrivateKey } from '@hashgraph/sdk';

export interface HCSMessage {
  consensusTimestamp: string;
  sequenceNumber: number;
  contents: string;
  runningHash: string;
}

export interface MinerRegistration {
  type: 'miner_registration';
  minerId: string;
  subnetIds: number[];
  stakeAmount: number;
  capabilities: string[];
  timestamp: number;
}

export interface ScoreSubmission {
  type: 'score_submission';
  taskId: string;
  minerId: string;
  validatorId: string;
  score: number;
  dimensions?: Record<string, number>;
  timestamp: number;
}

export interface TaskSubmission {
  type: 'task_submission';
  taskId: string;
  subnetId: number;
  requester: string;
  taskType: string;
  rewardAmount: number;
  timestamp: number;
}

export class HCSClient {
  private client: Client | null = null;
  private accountId: string;
  private privateKey: string;

  constructor() {
    this.accountId = process.env.NEXT_PUBLIC_HEDERA_ACCOUNT_ID || '';
    this.privateKey = process.env.HEDERA_PRIVATE_KEY || '';
  }

  async initialize() {
    if (this.client) return this.client;

    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
    
    if (network === 'testnet') {
      this.client = Client.forTestnet();
    } else {
      this.client = Client.forMainnet();
    }

    if (this.accountId && this.privateKey) {
      this.client.setOperator(
        AccountId.fromString(this.accountId),
        PrivateKey.fromStringECDSA(this.privateKey)
      );
    }

    return this.client;
  }

  async getTopicMessages(topicId: string, limit: number = 100): Promise<HCSMessage[]> {
    await this.initialize();
    if (!this.client) throw new Error('Client not initialized');

    const messages: HCSMessage[] = [];

    return new Promise((resolve, reject) => {
      const query = new TopicMessageQuery()
        .setTopicId(topicId)
        .setLimit(limit);

      query.subscribe(
        this.client!,
        (message) => {
          if (!message) return;
          messages.push({
            consensusTimestamp: message.consensusTimestamp.toString(),
            sequenceNumber: Number(message.sequenceNumber),
            contents: Buffer.from(message.contents).toString('utf8'),
            runningHash: Buffer.from(message.runningHash).toString('hex')
          });
        },
        (error) => {
          reject(error);
        }
      );

      // Wait a bit for messages to arrive
      setTimeout(() => {
        resolve(messages);
      }, 3000);
    });
  }

  async getMinerRegistrations(): Promise<MinerRegistration[]> {
    const topicId = process.env.NEXT_PUBLIC_REGISTRATION_TOPIC_ID;
    if (!topicId) return [];

    try {
      const messages = await this.getTopicMessages(topicId);
      return messages
        .map(msg => {
          try {
            const data = JSON.parse(msg.contents);
            if (data.type === 'miner_registration') {
              return data as MinerRegistration;
            }
          } catch (e) {
            // Ignore parse errors
          }
          return null;
        })
        .filter((m): m is MinerRegistration => m !== null);
    } catch (error) {
      console.error('Error fetching miner registrations:', error);
      return [];
    }
  }

  async getScoreSubmissions(): Promise<ScoreSubmission[]> {
    const topicId = process.env.NEXT_PUBLIC_SCORING_TOPIC_ID;
    if (!topicId) return [];

    try {
      const messages = await this.getTopicMessages(topicId);
      return messages
        .map(msg => {
          try {
            const data = JSON.parse(msg.contents);
            if (data.type === 'score_submission') {
              return data as ScoreSubmission;
            }
          } catch (e) {
            // Ignore parse errors
          }
          return null;
        })
        .filter((s): s is ScoreSubmission => s !== null);
    } catch (error) {
      console.error('Error fetching score submissions:', error);
      return [];
    }
  }

  async getTaskSubmissions(): Promise<TaskSubmission[]> {
    const topicId = process.env.NEXT_PUBLIC_TASK_TOPIC_ID;
    if (!topicId) return [];

    try {
      const messages = await this.getTopicMessages(topicId);
      return messages
        .map(msg => {
          try {
            const data = JSON.parse(msg.contents);
            if (data.type === 'task_submission') {
              return data as TaskSubmission;
            }
          } catch (e) {
            // Ignore parse errors
          }
          return null;
        })
        .filter((t): t is TaskSubmission => t !== null);
    } catch (error) {
      console.error('Error fetching task submissions:', error);
      return [];
    }
  }

  close() {
    if (this.client) {
      this.client.close();
      this.client = null;
    }
  }
}

export const hcsClient = new HCSClient();
