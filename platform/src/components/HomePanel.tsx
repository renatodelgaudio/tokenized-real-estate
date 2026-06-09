"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDeployment } from "@/hooks/useDeployment";
import {
  Settings2, ShieldCheck, Building2, BarChart3, ArrowRight,
  AlertTriangle, BookOpen, Wallet, FlaskConical, FileWarning,
  CheckCircle2, ChevronRight, Users, Lock, Database, Repeat2, Globe,
} from "lucide-react";

interface HomePanelProps {
  onNavigate: (tab: string) => void;
}

const ROLES = [
  {
    id: "admin",
    label: "Platform Operator",
    tab: "Admin",
    accent: "#6366f1",
    lightBg: "#eef2ff",
    border: "#c7d2fe",
    Icon: Settings2,
    realWorld: "A fintech infrastructure company (e.g. Tokeny, Taurus)",
    inPoC: "Your connected wallet — deploys the shared identity factories and token factory once per network.",
    tasks: ["Deploy IdFactory & ClaimIssuer", "Deploy TREXFactory", "Deploy shared Identity Registry"],
  },
  {
    id: "kyc",
    label: "KYC Provider",
    tab: "KYC Service",
    accent: "#059669",
    lightBg: "#ecfdf5",
    border: "#a7f3d0",
    Icon: ShieldCheck,
    realWorld: "An identity verification service (e.g. Onfido, Sumsub)",
    inPoC: "Your connected wallet — issues on-chain KYC claims after (simulated) document verification.",
    tasks: ["Verify investor documents", "Create on-chain identity via IdFactory", "Issue signed KYC claim"],
  },
  {
    id: "issuer",
    label: "Issuer / Asset Manager",
    tab: "Issuer",
    accent: "#d97706",
    lightBg: "#fffbeb",
    border: "#fde68a",
    Icon: Building2,
    realWorld: "A real-estate fund, REIT, or property developer",
    inPoC: "Your connected wallet — creates the token representing the asset, sets compliance rules, mints and transfers.",
    tasks: ["Deploy T-REX token (6 contracts)", "Configure compliance policy", "Mint to KYC'd investors"],
  },
  {
    id: "explorer",
    label: "Investor / Explorer",
    tab: "Explorer",
    accent: "#0ea5e9",
    lightBg: "#f0f9ff",
    border: "#bae6fd",
    Icon: BarChart3,
    realWorld: "Any accredited investor who has passed KYC",
    inPoC: "Any wallet you register in the KYC tab. Receives tokens; visible in the Explorer.",
    tasks: ["Hold a compliant T-REX token", "Transfer to other verified investors", "View portfolio in Explorer"],
  },
];

const HOW_IT_WORKS = [
  {
    n: 1,
    tab: "Admin",
    accent: "#6366f1",
    lightBg: "#eef2ff",
    Icon: Settings2,
    title: "Deploy Infrastructure",
    body: "One-time setup. Deploys ~26 contracts: OnchainID factories, T-REX factories, and a shared Identity Registry. Addresses are saved to your browser.",
  },
  {
    n: 2,
    tab: "KYC Service",
    accent: "#059669",
    lightBg: "#ecfdf5",
    Icon: ShieldCheck,
    title: "Onboard Investors",
    body: "Creates an on-chain identity for each investor via IdFactory, then adds a KYC claim signed by the ClaimIssuer. The claim is the on-chain proof of compliance.",
  },
  {
    n: 3,
    tab: "Issuer",
    accent: "#d97706",
    lightBg: "#fffbeb",
    Icon: Building2,
    title: "Create & Issue Token",
    body: "Deploys a full T-REX token suite (Token + Compliance + IdentityRegistry + three Registries). Choose a compliance policy, then mint to verified wallets.",
  },
  {
    n: 4,
    tab: "Issuer / Explorer",
    accent: "#0ea5e9",
    lightBg: "#f0f9ff",
    Icon: Repeat2,
    title: "Compliant Transfers",
    body: "Every token transfer automatically checks isVerified(recipient) on-chain. If the recipient hasn't passed KYC the transfer reverts — enforced by the smart contract, not a UI rule.",
  },
];

const LIMITATIONS = [
  {
    Icon: Wallet,
    title: "Single wallet, all roles",
    body: "Your connected wallet signs every transaction — as operator, KYC provider, and issuer simultaneously. In production each is a separate organisation with its own signing key and access controls.",
  },
  {
    Icon: FlaskConical,
    title: "Mock document scanning",
    body: "The 'Upload document' step is purely visual. No real OCR, biometric check, or AML screening runs. The scan animation and green ticks are simulated.",
  },
  {
    Icon: FileWarning,
    title: "Hardcoded KYC claim data",
    body: "All KYC claims carry the same static data string. A production system issues individualised, expiring claims differentiated per investor and token offering.",
  },
  {
    Icon: Database,
    title: "Labels live in your browser only",
    body: "Investor names, company labels, and deployment addresses are stored in localStorage. Clearing browser storage loses them. Nothing personally identifiable is ever written on-chain.",
  },
  {
    Icon: Lock,
    title: "MetaMask / injected wallet only",
    body: "No WalletConnect or other connectors. The app is a static export with no backend, so only the browser-injected provider is supported.",
  },
  {
    Icon: AlertTriangle,
    title: "Sepolia testnet — no real value",
    body: "All contracts deploy to Sepolia. Tokens represent a fictional asset and carry zero economic value. Never add mainnet network configs to this PoC.",
  },
];

const GUIDE_STEPS = [
  {
    n: 1,
    accent: "#6366f1",
    title: "Switch MetaMask to Sepolia",
    body: "You need Sepolia ETH for gas. Get some from a faucet (e.g. sepoliafaucet.com) if your balance is zero.",
  },
  {
    n: 2,
    accent: "#6366f1",
    title: "Connect your wallet",
    body: "Click \"Connect Wallet\" (top-right). Approve the connection in MetaMask. The app only reads your address — no signature until you take an action.",
  },
  {
    n: 3,
    accent: "#6366f1",
    title: "Admin → Deploy platform infrastructure",
    body: "Opens the shared contract layer. Confirms ~26 wallet transactions one by one. Do this once; addresses are saved to your browser and persist across page reloads.",
  },
  {
    n: 4,
    accent: "#059669",
    title: "KYC → Onboard yourself as an investor",
    body: "Fill in the investor details form (natural person or legal entity), complete the mock document scan, then register your own wallet address on-chain. Repeat for any other wallet you want to receive tokens.",
  },
  {
    n: 5,
    accent: "#d97706",
    title: "Issuer → Create a token",
    body: "Give the token a name, symbol, and choose a compliance policy: \"Whitelist all\" (every KYC'd investor can receive it) or \"Whitelist custom\" (only explicitly added wallets).",
  },
  {
    n: 6,
    accent: "#d97706",
    title: "Issuer → Mint tokens",
    body: "Select your token, enter an amount and your own wallet as recipient. The token must be unpaused first (done automatically on creation).",
  },
  {
    n: 7,
    accent: "#d97706",
    title: "Issuer → Transfer tokens",
    body: "Enter a recipient wallet that has been KYC'd. Use \"Diagnose recipient\" if a transfer fails — it tells you exactly which compliance check is failing and how to fix it.",
  },
  {
    n: 8,
    accent: "#0ea5e9",
    title: "Explorer → Browse the platform",
    body: "See all deployed tokens, their total supply, and onboarded investors. Anyone with the deployment JSON (copy it from Admin) can view this without their own wallet.",
  },
];

export function HomePanel({ onNavigate }: HomePanelProps) {
  const { isPublished } = useDeployment();

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Hero ── */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-8 text-white">
          <div className="flex flex-wrap items-start gap-3 mb-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              <FlaskConical size={11} /> Learning Proof-of-Concept
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              ERC-3643 · T-REX
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/30 text-amber-200 px-3 py-1 text-xs font-semibold">
              Sepolia testnet only
            </span>
          </div>
          <h2 className="text-2xl font-extrabold leading-tight mb-2">
            How does a regulated security token platform work?
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed max-w-2xl">
            This app walks you through the full lifecycle of a tokenized real-estate security under the{" "}
            <b className="text-white">ERC-3643 (T-REX)</b> standard — from deploying the shared infrastructure,
            through KYC-ing investors, to issuing a compliant token and executing on-chain transfers.
            No real asset, no mainnet, no economic value — pure learning.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              onClick={() => onNavigate("admin")}
              className="gap-2 bg-white text-slate-900 hover:bg-slate-100 font-semibold"
            >
              Get started <ChevronRight size={15} />
            </Button>
            <button
              onClick={() => onNavigate("explorer")}
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-transparent px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white/10"
            >
              Browse Explorer
            </button>
          </div>
        </div>

        {/* What is ERC-3643 strip */}
        <CardContent className="pt-5 pb-5 border-t border-slate-100 bg-slate-50">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">What is ERC-3643 / T-REX?</p>
          <p className="text-sm text-slate-700 leading-relaxed">
            ERC-3643 is a permissioned token standard for regulated securities built on top of ERC-20.
            Every <code className="text-xs bg-white border border-slate-200 rounded px-1 py-0.5">transfer</code> call
            automatically verifies that both sender and receiver hold a valid on-chain{" "}
            <b>KYC claim</b> issued by a trusted <b>ClaimIssuer</b>.
            If either party fails the check, the transfer reverts — enforced by the smart contract,
            not an off-chain rule. Think of it as ERC-20 with built-in, auditable compliance.
          </p>
        </CardContent>
      </Card>

      {/* ── Published-deployment notice ── */}
      {isPublished && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
              <Globe size={15} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-indigo-900 mb-1">
                Infrastructure already provisioned — no setup required
              </p>
              <p className="text-sm text-indigo-800 leading-relaxed">
                This shared instance has a pre-configured deployment on-chain. The platform operator has already
                run the Admin step and committed the contract addresses to this site.{" "}
                <b>You can go directly to KYC or Issuer</b> — there is nothing to deploy.
              </p>
              <p className="mt-2 text-xs text-indigo-600">
                If you need an independent deployment (e.g. to experiment without affecting shared state), clone
                the repository, leave <code>published.ts</code> empty for your network, and run the Admin step
                from your own instance.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  onClick={() => onNavigate("kyc")}
                  className="gap-1.5 text-xs px-3 py-1.5"
                  style={{ backgroundColor: "#059669" }}
                >
                  <ShieldCheck size={13} /> Go to KYC Service
                </Button>
                <Button
                  onClick={() => onNavigate("issuer")}
                  className="gap-1.5 text-xs px-3 py-1.5"
                  style={{ backgroundColor: "#d97706" }}
                >
                  <Building2 size={13} /> Go to Issuer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── How it works ── */}
      <div>
        <SectionHeader icon={<BookOpen size={15} />} title="How it works" subtitle="The four stages of the platform lifecycle" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((s, i) => (
            <div key={s.n} className="relative">
              <Card
                className="h-full cursor-pointer hover:shadow-card-md transition-shadow"
                onClick={() => onNavigate(["admin", "kyc", "issuer", "explorer"][i])}
              >
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-xl text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: s.accent }}
                    >
                      {s.n}
                    </div>
                    <span
                      className="text-xs font-semibold rounded-full px-2 py-0.5"
                      style={{ backgroundColor: s.lightBg, color: s.accent }}
                    >
                      {s.tab}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-800 mb-1.5">{s.title}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{s.body}</p>
                  {s.n === 1 && isPublished && (
                    <p className="mt-1.5 text-xs font-medium text-indigo-600">
                      Already done on this shared instance — skip to step 2.
                    </p>
                  )}
                </CardContent>
              </Card>
              {i < HOW_IT_WORKS.length - 1 && (
                <div className="hidden lg:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10 h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                  <ArrowRight size={10} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── The roles ── */}
      <div>
        <SectionHeader
          icon={<Users size={15} />}
          title="One wallet, four roles"
          subtitle="In a real deployment each role belongs to a separate organisation. In this PoC your single connected wallet plays all of them."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLES.map((r) => (
            <Card
              key={r.id}
              className="cursor-pointer hover:shadow-card-md transition-shadow"
              onClick={() => onNavigate(r.id)}
              style={{ borderColor: r.border }}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: r.lightBg }}
                  >
                    <r.Icon size={17} style={{ color: r.accent }} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-sm font-bold text-slate-800">{r.label}</span>
                      <span
                        className="text-xs font-semibold rounded-full px-2 py-0.5"
                        style={{ backgroundColor: r.lightBg, color: r.accent }}
                      >
                        {r.tab}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-1.5 italic">{r.realWorld}</p>
                    <p className="text-xs text-slate-600 leading-relaxed mb-2">{r.inPoC}</p>
                    <div className="flex flex-wrap gap-1">
                      {r.tasks.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                          <CheckCircle2 size={9} className="text-slate-400" /> {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ── PoC limitations ── */}
      <div>
        <SectionHeader
          icon={<AlertTriangle size={15} className="text-amber-500" />}
          title="PoC shortcuts & limitations"
          subtitle="Honest about what this demo simplifies compared to a real production deployment"
        />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LIMITATIONS.map((l) => (
              <div key={l.title} className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                  <l.Icon size={15} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-900 mb-0.5">{l.title}</p>
                  <p className="text-xs text-amber-800 leading-relaxed">{l.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Step-by-step guide ── */}
      <div>
        <SectionHeader
          icon={<BookOpen size={15} />}
          title="Step-by-step walkthrough"
          subtitle="Follow these steps in order the first time you use the platform"
        />
        <div className="space-y-2">
          {GUIDE_STEPS.map((s) => {
            const skipped = s.n === 3 && isPublished;
            return (
              <div
                key={s.n}
                className={`flex gap-3 rounded-xl border px-4 py-3 ${skipped ? "border-indigo-100 bg-indigo-50 opacity-60" : "border-slate-100 bg-white"}`}
              >
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold mt-0.5"
                  style={{ backgroundColor: skipped ? "#6366f1" : s.accent }}
                >
                  {s.n}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">{s.title}</p>
                    {skipped && (
                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-100 rounded-full px-2 py-0.5">
                        Already done — skip
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                    {s.n === 3 && isPublished
                      ? "Infrastructure is pre-configured on this shared instance. Check the Admin tab to view the deployed contract addresses, then proceed to step 4."
                      : s.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── CTA ── */}
      <Card className={`border ${isPublished ? "bg-gradient-to-r from-emerald-50 to-slate-50 border-emerald-100" : "bg-gradient-to-r from-indigo-50 to-slate-50 border-indigo-100"}`}>
        <CardContent className="pt-5 pb-5 flex flex-wrap items-center justify-between gap-4">
          {isPublished ? (
            <>
              <div>
                <p className="text-sm font-bold text-slate-800">Ready to go — infrastructure is live.</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Connect your wallet and head to <b>KYC Service</b> to onboard yourself as an investor,
                  then <b>Issuer</b> to create and mint your first token.
                </p>
              </div>
              <Button
                onClick={() => onNavigate("kyc")}
                className="gap-2 shrink-0"
                style={{ backgroundColor: "#059669" }}
              >
                <ShieldCheck size={14} /> Go to KYC Service
              </Button>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm font-bold text-slate-800">Ready to start?</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Open the <b>Admin</b> tab and deploy the platform infrastructure. It takes about two minutes and ~26 wallet confirmations.
                </p>
              </div>
              <Button
                onClick={() => onNavigate("admin")}
                className="gap-2 shrink-0"
                style={{ backgroundColor: "#6366f1" }}
              >
                <Settings2 size={14} /> Go to Admin tab
              </Button>
            </>
          )}
        </CardContent>
      </Card>

    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-2 mb-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 mt-0.5">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>
    </div>
  );
}
