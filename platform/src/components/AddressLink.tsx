"use client";

import { useChainId } from "wagmi";
import { shorten } from "@/lib/format";
import { explorerAddressUrl } from "@/lib/wagmi";

/** Shows a shortened address with a copy button and (on public chains) an explorer link. */
export function AddressLink({ address, full = false }: { address?: string; full?: boolean }) {
  const chainId = useChainId();
  if (!address) return <span className="text-slate-400">—</span>;
  const url = explorerAddressUrl(chainId, address);

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="mono text-slate-700">{full ? address : shorten(address)}</span>
      <button
        title="Copy"
        onClick={() => navigator.clipboard.writeText(address)}
        className="text-slate-400 hover:text-slate-700"
      >
        ⧉
      </button>
      {url && (
        <a href={url} target="_blank" rel="noreferrer" title="View on explorer" className="text-slate-400 hover:text-slate-700">
          ↗
        </a>
      )}
    </span>
  );
}
