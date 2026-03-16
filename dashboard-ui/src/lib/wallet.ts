import { ethers } from 'ethers';

export interface WalletState {
  address: string | null;
  isConnected: boolean;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  walletType: 'metamask' | 'hashpack' | null;
}

export class WalletService {
  private state: WalletState = {
    address: null,
    isConnected: false,
    provider: null,
    signer: null,
    walletType: null
  };

  private listeners: Array<(state: WalletState) => void> = [];

  subscribe(listener: (state: WalletState) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(listener => listener(this.state));
  }

  getState() {
    return { ...this.state };
  }

  async connectMetaMask() {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = accounts[0];

      // Switch to Hedera testnet
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x128' }], // 296 in hex = Hedera testnet
        });
      } catch (switchError: any) {
        // Chain not added, add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x128',
              chainName: 'Hedera Testnet',
              nativeCurrency: {
                name: 'HBAR',
                symbol: 'HBAR',
                decimals: 18
              },
              rpcUrls: ['https://testnet.hashio.io/api'],
              blockExplorerUrls: ['https://hashscan.io/testnet']
            }]
          });
        }
      }

      this.state = {
        address,
        isConnected: true,
        provider,
        signer,
        walletType: 'metamask'
      };

      this.notify();
      return address;
    } catch (error) {
      console.error('Failed to connect MetaMask:', error);
      throw error;
    }
  }

  async connectHashPack() {
    if (typeof window === 'undefined') {
      throw new Error('HashPack is not available');
    }

    try {
      // HashPack integration
      const hashconnect = (window as any).hashconnect;
      
      if (!hashconnect) {
        throw new Error('HashPack is not installed');
      }

      // Initialize HashConnect
      const appMetadata = {
        name: 'ModernTensor',
        description: 'Decentralized AI Marketplace on Hedera',
        icon: 'https://moderntensor.io/icon.png'
      };

      await hashconnect.init(appMetadata, 'testnet', false);
      
      const pairingData = await hashconnect.connectToLocalWallet();
      
      if (pairingData) {
        const accountId = pairingData.accountIds[0];
        const evmAddress = this.accountIdToEvmAddress(accountId);

        this.state = {
          address: evmAddress,
          isConnected: true,
          provider: null, // HashPack uses its own provider
          signer: null,
          walletType: 'hashpack'
        };

        this.notify();
        return evmAddress;
      }

      throw new Error('Failed to connect HashPack');
    } catch (error) {
      console.error('Failed to connect HashPack:', error);
      throw error;
    }
  }

  async disconnect() {
    this.state = {
      address: null,
      isConnected: false,
      provider: null,
      signer: null,
      walletType: null
    };
    this.notify();
  }

  // Convert Hedera Account ID to EVM address
  private accountIdToEvmAddress(accountId: string): string {
    // Simple conversion - in production use proper Hedera SDK conversion
    const parts = accountId.split('.');
    const num = parseInt(parts[2]);
    return '0x' + num.toString(16).padStart(40, '0');
  }

  // Listen for account changes
  setupListeners() {
    if (typeof window === 'undefined' || !window.ethereum) return;

    window.ethereum.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length === 0) {
        this.disconnect();
      } else if (this.state.walletType === 'metamask') {
        this.state.address = accounts[0];
        this.notify();
      }
    });

    window.ethereum.on('chainChanged', () => {
      window.location.reload();
    });
  }
}

export const walletService = new WalletService();

// Setup listeners on client side
if (typeof window !== 'undefined') {
  walletService.setupListeners();
}

declare global {
  interface Window {
    ethereum?: any;
    hashconnect?: any;
  }
}
