"use client";

import { ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
// Phantom auto-detects via standard wallet adapter — no explicit import needed
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { RPC_ENDPOINT } from "@/utils/constants";

import "@solana/wallet-adapter-react-ui/styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  const wallets = useMemo(() => [], []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* @ts-ignore - wallet adapter React type mismatch with React 18 */}
      <ConnectionProvider endpoint={RPC_ENDPOINT}>
        {/* @ts-ignore */}
        <WalletProvider wallets={wallets} autoConnect>
          {/* @ts-ignore */}
          <WalletModalProvider>
            <AuthProvider>{children}</AuthProvider>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  );
}
