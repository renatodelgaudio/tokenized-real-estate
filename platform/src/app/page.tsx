"use client";

import { useState } from "react";
import { ConnectBar } from "@/components/ConnectBar";
import { AdminPanel } from "@/components/AdminPanel";
import { KycPanel } from "@/components/KycPanel";
import { IssuerPanel } from "@/components/IssuerPanel";
import { ExplorerPanel } from "@/components/ExplorerPanel";
import { useMounted } from "@/hooks/useMounted";
import { cn } from "@/lib/utils";
import { Settings2, ShieldCheck, Building2, BarChart3 } from "lucide-react";

type Tab = "admin" | "kyc" | "issuer" | "explorer";

const TABS: {
  id: Tab;
  label: string;
  description: string;
  accent: string;
  lightBg: string;
  border: string;
  Icon: React.ElementType;
}[] = [
  {
    id: "admin",
    label: "Admin",
    description: "Deploy platform infrastructure",
    accent: "#6366f1",
    lightBg: "#eef2ff",
    border: "#c7d2fe",
    Icon: Settings2,
  },
  {
    id: "kyc",
    label: "KYC Service",
    description: "Verify & onboard investors",
    accent: "#059669",
    lightBg: "#ecfdf5",
    border: "#a7f3d0",
    Icon: ShieldCheck,
  },
  {
    id: "issuer",
    label: "Issuer",
    description: "Tokenize assets & distribute",
    accent: "#d97706",
    lightBg: "#fffbeb",
    border: "#fde68a",
    Icon: Building2,
  },
  {
    id: "explorer",
    label: "Explorer",
    description: "Browse tokens & investors",
    accent: "#0ea5e9",
    lightBg: "#f0f9ff",
    border: "#bae6fd",
    Icon: BarChart3,
  },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("admin");
  const mounted = useMounted();
  const activeTab = TABS.find((t) => t.id === tab)!;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8">

        {/* Header */}
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white text-lg font-bold shadow-card-md">
              T
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 leading-tight">Tokenized Real Estate</h1>
              <p className="text-xs text-slate-400 font-medium">ERC-3643 · T-REX · Sepolia testnet · Learning PoC</p>
            </div>
          </div>
          {mounted ? <ConnectBar /> : (
            <div className="btn-outline pointer-events-none opacity-60 text-sm">Connect Wallet</div>
          )}
        </header>

        {/* Role explanation banner */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-card">
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-800">One wallet, four roles.</span>{" "}
            In this PoC your connected wallet acts as all parties: the{" "}
            <span className="font-medium" style={{ color: "#6366f1" }}>platform operator</span> who deploys shared infrastructure,
            the{" "}
            <span className="font-medium" style={{ color: "#059669" }}>KYC provider</span> who verifies investors,
            and each{" "}
            <span className="font-medium" style={{ color: "#d97706" }}>issuer</span> who tokenizes their asset.
          </p>
        </div>

        {/* Role nav cards */}
        <nav className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TABS.map((t) => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "group relative flex flex-col items-start gap-1.5 rounded-2xl border p-4 text-left transition-all duration-200",
                  isActive
                    ? "shadow-card-md"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-card"
                )}
                style={isActive ? {
                  backgroundColor: t.lightBg,
                  borderColor: t.border,
                } : undefined}
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors"
                  style={{
                    backgroundColor: isActive ? t.accent : "#f1f5f9",
                    color: isActive ? "white" : t.accent,
                  }}
                >
                  <t.Icon size={16} />
                </div>
                <div>
                  <div
                    className="text-sm font-bold leading-tight"
                    style={{ color: isActive ? t.accent : "#1e293b" }}
                  >
                    {t.label}
                  </div>
                  <div className={cn("mt-0.5 text-xs leading-tight", isActive ? "text-slate-600" : "text-slate-400")}>
                    {t.description}
                  </div>
                </div>
                {isActive && (
                  <div
                    className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full"
                    style={{ backgroundColor: activeTab.accent }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Panel */}
        {!mounted ? (
          <div className="card p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : (
          <div className="animate-fade-in">
            {tab === "admin" && <AdminPanel />}
            {tab === "kyc" && <KycPanel />}
            {tab === "issuer" && <IssuerPanel />}
            {tab === "explorer" && <ExplorerPanel />}
          </div>
        )}

        <footer className="mt-10 text-center text-xs text-slate-400">
          Learning PoC · ERC-3643 · testnet only · no real asset or value
        </footer>
      </div>
    </div>
  );
}
