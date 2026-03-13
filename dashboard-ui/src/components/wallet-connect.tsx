'use client';

import { useState, useEffect } from 'react';
import { Wallet, LogOut } from 'lucide-react';
import { walletService, type WalletState } from '@/lib/wallet';

export function WalletConnect() {
  const [walletState, setWalletState] = useState<WalletState>(walletService.getState());
  const [isConnecting, setIsConnecting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const unsubscribe = walletService.subscribe(setWalletState);
    return unsubscribe;
  }, []);

  const handleConnectMetaMask = async () => {
    setIsConnecting(true);
    try {
      await walletService.connectMetaMask();
      setShowMenu(false);
    } catch (error) {
      console.error('Failed to connect:', error);
      alert('Failed to connect MetaMask. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectHashPack = async () => {
    setIsConnecting(true);
    try {
      await walletService.connectHashPack();
      setShowMenu(false);
    } catch (error) {
      console.error('Failed to connect:', error);
      alert('Failed to connect HashPack. Please install the extension.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await walletService.disconnect();
    setShowMenu(false);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (walletState.isConnected && walletState.address) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Wallet className="w-4 h-4" />
          <span className="font-medium">{formatAddress(walletState.address)}</span>
          <span className="text-xs opacity-75">
            ({walletState.walletType === 'metamask' ? 'MetaMask' : 'HashPack'})
          </span>
        </button>

        {showMenu && (
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
            <button
              onClick={handleDisconnect}
              className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-lg"
            >
              <LogOut className="w-4 h-4" />
              <span>Disconnect</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={isConnecting}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Wallet className="w-4 h-4" />
        <span className="font-medium">
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </span>
      </button>

      {showMenu && !isConnecting && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="p-2">
            <button
              onClick={handleConnectMetaMask}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-lg"
            >
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">M</span>
              </div>
              <div>
                <div className="font-medium">MetaMask</div>
                <div className="text-xs text-gray-500">Connect with MetaMask</div>
              </div>
            </button>

            <button
              onClick={handleConnectHashPack}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-lg mt-1"
            >
              <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">H</span>
              </div>
              <div>
                <div className="font-medium">HashPack</div>
                <div className="text-xs text-gray-500">Connect with HashPack</div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
