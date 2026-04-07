"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
// @ts-ignore
import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  FREIGHTER_ID,
} from "@creit.tech/stellar-wallets-kit";

interface WalletContextType {
  address: string | null;
  kit: StellarWalletsKit | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  isConnecting: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [kit, setKit] = useState<StellarWalletsKit | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // Initialize the kit
    const swk = new StellarWalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: FREIGHTER_ID,
      modules: allowAllModules(),
    });
    setKit(swk);
  }, []);

  const connect = async () => {
    if (!kit || isConnecting) return;
    try {
      setIsConnecting(true);
      await kit.openModal({
        onWalletSelected: async (option: any) => {
          try {
            kit.setWallet(option.id);
            const kitAddr = await kit.getAddress();
            const addr = typeof kitAddr === "string" ? kitAddr : kitAddr.address;
            setAddress(addr || null);
          } catch (internalErr) {
            console.warn("Wallet selection was cancelled or failed.");
            // We consciously suppress thrown alerts here so Next.js doesn't throw a dev overlay
            // when the user simply clicks 'Reject' or closes the Freighter popup.
          }
        },
      });
    } catch (e) {
      console.warn("Wallet connection modal closed or failed.");
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setAddress(null);
  };

  return (
    <WalletContext.Provider value={{ address, kit, connect, disconnect, isConnecting }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};
