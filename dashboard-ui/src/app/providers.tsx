'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh';
import { WalletProvider } from '@/context/WalletContext';

import { ThemeProvider } from 'next-themes';

// Inner component that uses auto-refresh (has access to QueryClient context)
function AutoRefreshProvider({ children }: { children: React.ReactNode }) {
    useAutoRefresh();
    return <>{children}</>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 5 * 1000,           // 5s - data considered fresh
                        refetchInterval: 5 * 1000,     // auto poll every 5s
                        refetchOnWindowFocus: true,     // refresh when tab focused
                        refetchIntervalInBackground: false,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
                <WalletProvider>
                    <AutoRefreshProvider>
                        {children}
                    </AutoRefreshProvider>
                </WalletProvider>
            </ThemeProvider>
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );
}
