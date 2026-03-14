'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { LedgerId } from '@hashgraph/sdk';

// Import types only
import type { HashConnect } from 'hashconnect';

interface WalletState {
    address: string | null;
    accountId: string | null;
    balance: string | null;
    type: 'hashpack' | 'metamask' | null;
    isConnected: boolean;
    isMiner: boolean;
    isValidator: boolean;
}

interface WalletContextType extends WalletState {
    connectHashPack: () => Promise<void>;
    connectMetaMask: () => Promise<void>;
    disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const APP_METADATA = {
    name: "ModernTensor Dashboard",
    description: "AI Marketplace Agentic Dashboard",
    icons: ["https://cdn.prod.website-files.com/614c99cf4f23700c8aa3752a/6323b696c42eaa1be5f8152a_public.png"],
    url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
};

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<WalletState>({
        address: null,
        accountId: null,
        balance: null,
        type: null,
        isConnected: false,
        isMiner: false,
        isValidator: false,
    });

    const [hc, setHc] = useState<HashConnect | null>(null);

    const checkRealStatus = useCallback(async (idOrAddress: string, type: 'hashpack' | 'metamask') => {
        try {
            const res = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${idOrAddress}`);
            const data = await res.json();
            
            const accountId = data.account;
            const evmAddress = data.evm_address || idOrAddress;
            const balance = (data.balance?.balance / 1e8).toFixed(2) || '0.00';

            const minerRes = await fetch('/api/miners');
            const minerData = await minerRes.json();
            const miners = minerData.miners || {};
            
            const validatorRes = await fetch('/api/validators');
            const validatorData = await validatorRes.json();
            const validators = validatorData.validators || [];

            const isM = !!Object.values(miners).find((m: any) => m.account_id === accountId);
            const isV = !!validators.find((v: any) => v.account_id === accountId || v.id === accountId);

            setState({
                address: evmAddress,
                accountId,
                balance,
                type,
                isConnected: true,
                isMiner: isM,
                isValidator: isV,
            });
            
            localStorage.setItem('mt_wallet_type', type);
            localStorage.setItem('mt_wallet_id', idOrAddress);
        } catch (error) {
            console.error("Failed to sync wallet status", error);
        }
    }, []);

    const HC_INIT_REF = useRef(false);

    // Initialize HashConnect dynamically to avoid SSR errors
    useEffect(() => {
        const initHC = async () => {
            try {
                if (HC_INIT_REF.current) return;
                HC_INIT_REF.current = true;

                const { HashConnect } = await import('hashconnect');
                
                // Use a verified public WC Project ID instead of relying on env to eliminate errors
                const projectId = "21fef48091f12692cad574a6f7753643";
                const hashconnect = new HashConnect(
                    LedgerId.TESTNET,
                    projectId,
                    APP_METADATA,
                    true // Set debug to true to see logs in browser console
                );
                
                // Register event *before* init in v3
                hashconnect.pairingEvent.on((pairingData: any) => {
                    console.log("HashPack Paired Event Fired", pairingData);
                    const account = pairingData.accountIds?.[0];
                    if (account) {
                        checkRealStatus(account, 'hashpack');
                    }
                });

                hashconnect.connectionStatusChangeEvent.on((status: any) => {
                    console.log("HashConnect Status Change", status);
                });

                await hashconnect.init();
                setHc(hashconnect);
                console.log("HashConnect Initialized Successfully");

            } catch (err) {
                console.error("Failed to load and initialize HashConnect v3", err);
                HC_INIT_REF.current = false; // allow retry
            }
        };

        if (typeof window !== 'undefined') {
            initHC();
        }
    }, [checkRealStatus]);

    const connectHashPack = async () => {
        try {
            console.log("Initiating HashPack Connection...", !!hc);
            if (!hc) {
               console.warn("HashConnect instance not found. Re-initializing...");
               const { HashConnect } = await import('hashconnect');
               const projectId = "21fef48091f12692cad574a6f7753643";
               const hashconnect = new HashConnect(
                   LedgerId.TESTNET,
                   projectId,
                   APP_METADATA,
                   true
               );
               hashconnect.pairingEvent.on((pairingData: any) => {
                   console.log("HashPack Paired Event Fired (Late Init)", pairingData);
                   const account = pairingData.accountIds?.[0];
                   if (account) checkRealStatus(account, 'hashpack');
               });
               await hashconnect.init();
               setHc(hashconnect);
               console.log("HashConnect Late Init Done. Opening Modal...");
               await hashconnect.openPairingModal();
               return;
            }

            console.log("Opening Pairing Modal with existing HC instance...");
            await hc.openPairingModal();
        } catch (e: any) {
            console.error("HashPack Connection Failed", e);
            alert(`HashPack connection failed: ${e.message || 'Unknown Error'}`);
        }
    };

    const connectMetaMask = async () => {
        const ethereum = (window as any).ethereum;
        if (typeof ethereum !== 'undefined') {
            try {
                const provider = new ethers.BrowserProvider(ethereum);
                const accounts = await provider.send("eth_requestAccounts", []);
                const address = accounts[0];
                if (address) {
                    await checkRealStatus(address, 'metamask');
                }
            } catch (e) {
                console.error("MetaMask Connection Failed", e);
            }
        } else {
            alert("Please install MetaMask!");
        }
    };

    const disconnect = async () => {
        if (state.type === 'hashpack' && hc) {
            await hc.disconnect();
        }
        
        setState({
            address: null,
            accountId: null,
            balance: null,
            type: null,
            isConnected: false,
            isMiner: false,
            isValidator: false,
        });
        
        localStorage.removeItem('mt_wallet_type');
        localStorage.removeItem('mt_wallet_id');
    };

    // Auto-reconnect and persistent sync
    useEffect(() => {
        const savedType = localStorage.getItem('mt_wallet_type');
        const savedId = localStorage.getItem('mt_wallet_id');
        
        if (savedType && savedId) {
            checkRealStatus(savedId, savedType as 'hashpack' | 'metamask');
        }

        // Periodic balance sync if connected
        const interval = setInterval(() => {
            const currentId = localStorage.getItem('mt_wallet_id');
            const currentType = localStorage.getItem('mt_wallet_type');
            if (currentId && currentType) {
                checkRealStatus(currentId, currentType as 'hashpack' | 'metamask');
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [checkRealStatus]);

    return (
        <WalletContext.Provider value={{ ...state, connectHashPack, connectMetaMask, disconnect }}>
            {children}
        </WalletContext.Provider>
    );
};

export const useWallet = () => {
    const context = useContext(WalletContext);
    if (context === undefined) {
        throw new Error('useWallet must be used within a WalletProvider');
    }
    return context;
};
