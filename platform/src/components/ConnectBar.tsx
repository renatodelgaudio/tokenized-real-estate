"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { shorten } from "@/lib/format";
import { SUPPORTED_CHAINS } from "@/lib/wagmi";

export function ConnectBar() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain, chains } = useSwitchChain();
  const [pickerOpen, setPickerOpen] = useState(false);

  const chainName = SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS]?.name ?? `Chain ${chainId}`;

  // Dedupe connectors by display name (EIP-6963 discovery + the generic
  // fallback can otherwise list the same wallet twice).
  const wallets = connectors.filter(
    (c, i, arr) => arr.findIndex((x) => x.name === c.name) === i
  );

  return (
    <div className="relative flex flex-wrap items-center gap-3">
      {isConnected && (
        <select
          className="input w-auto"
          value={chainId}
          onChange={(e) => switchChain({ chainId: Number(e.target.value) })}
        >
          {chains.map((c) => (
            <option key={c.id} value={c.id}>
              {SUPPORTED_CHAINS[c.id as keyof typeof SUPPORTED_CHAINS]?.name ?? c.name}
            </option>
          ))}
        </select>
      )}

      {isConnected ? (
        <div className="flex items-center gap-2">
          <span className="badge bg-emerald-100 text-emerald-700">● {chainName}</span>
          <span className="mono rounded-lg bg-slate-100 px-3 py-2 text-slate-700">{shorten(address)}</span>
          <button className="btn-outline" onClick={() => disconnect()}>
            Disconnect
          </button>
        </div>
      ) : (
        <>
          <button className="btn-primary" onClick={() => setPickerOpen((o) => !o)} disabled={isPending}>
            {isPending ? "Connecting…" : "Connect Wallet"}
          </button>

          {pickerOpen && (
            <div className="absolute right-0 top-12 z-10 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              <p className="px-2 py-1 text-xs font-semibold uppercase text-slate-400">Choose a wallet</p>
              {wallets.length === 0 && (
                <p className="px-2 py-2 text-sm text-slate-500">
                  No wallet detected. Install MetaMask or another browser wallet.
                </p>
              )}
              {wallets.map((connector) => (
                <button
                  key={connector.uid}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100"
                  onClick={() => {
                    connect({ connector });
                    setPickerOpen(false);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {connector.icon && <img src={connector.icon} alt="" className="h-5 w-5" />}
                  <span className="font-medium text-slate-700">{connector.name}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
