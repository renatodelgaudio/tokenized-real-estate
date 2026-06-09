"use client";

import { useState, useEffect } from "react";
import { useAccount, useConfig, useChainId } from "wagmi";
import type { Address } from "viem";
import { getLabel } from "@/lib/labels";
import { useAction } from "./ui";
import { AddressLink } from "./AddressLink";
import { useDeployment } from "@/hooks/useDeployment";
import { useInvestors, useTokens } from "@/hooks/useRegistry";
import {
  deployToken,
  tokenPaused,
  unpauseToken,
  mintToken,
  transferToken,
  balanceOf,
  whitelistWalletOnToken,
  getTokenRoles,
  diagnoseVerification,
  type TokenRoles,
  type DiagItem,
} from "@/lib/platform";
import { Policy, DEFAULT_COUNTRY } from "@/lib/constants";
import type { PlatformDeployment } from "@/lib/deployments";
import { isAddress, shorten } from "@/lib/format";
import { Stepper } from "@/components/ui/stepper";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusLine, SuccessBox } from "@/components/ui/status-line";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Building2, Plus, ArrowLeft, Coins, ArrowRightLeft,
  ShieldPlus, LayoutDashboard, PauseCircle, PlayCircle,
  CheckCircle2, XCircle, ChevronRight, ChevronLeft, Zap,
} from "lucide-react";

const ACCENT = "#d97706";

const CREATE_STEPS = [
  { label: "Asset Details" },
  { label: "KYC Policy" },
  { label: "Deploy" },
];

type View = "dashboard" | "create" | { token: Address; name: string; symbol: string; policy: number };

export function IssuerPanel() {
  const { address, isConnected } = useAccount();
  const config = useConfig();
  const chainId = useChainId();
  const { deployment } = useDeployment();
  const { investors } = useInvestors(deployment);
  const { tokens, refresh: refreshTokens } = useTokens(deployment);
  const [view, setView] = useState<View>("dashboard");

  if (!isConnected) return <BlockedCard message="Connect your wallet to use the Issuer portal." />;
  if (!deployment) return <BlockedCard message="Deploy the platform infrastructure in the Admin tab first." />;

  if (view === "create") {
    return (
      <CreateTokenWizard
        deployment={deployment}
        investors={investors.map((inv) => ({ address: inv.wallet, label: getLabel(chainId, inv.identity) }))}
        onBack={() => setView("dashboard")}
        onCreated={async () => { await refreshTokens(); setView("dashboard"); }}
      />
    );
  }

  if (typeof view === "object") {
    const { token, name, symbol, policy } = view;
    return (
      <TokenManager
        token={token}
        name={name}
        symbol={symbol}
        policy={policy}
        deployment={deployment}
        recipients={investors.map((inv) => ({ address: inv.wallet, label: getLabel(chainId, inv.identity) }))}
        onBack={() => setView("dashboard")}
      />
    );
  }

  // Dashboard
  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ backgroundColor: "#fffbeb" }}>
                <Building2 size={20} style={{ color: ACCENT }} />
              </div>
              <div>
                <CardTitle>Issuer Portal</CardTitle>
                <CardDescription>Deploy security tokens and distribute them to verified investors.</CardDescription>
              </div>
            </div>
            <Button onClick={() => setView("create")} style={{ backgroundColor: ACCENT }}>
              <Plus size={15} /> New Token
            </Button>
          </div>
        </CardHeader>
      </Card>

      {tokens.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 size={36} className="mx-auto mb-3 text-slate-200" />
            <p className="text-sm font-medium text-slate-500">No tokens issued yet.</p>
            <p className="text-xs text-slate-400 mt-1">Click "New Token" to deploy your first security token.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tokens.map((t) => (
            <TokenCard
              key={t.token}
              token={t.token}
              name={t.name}
              symbol={t.symbol}
              policy={t.policy}
              config={config}
              onManage={() => setView({ token: t.token, name: t.name, symbol: t.symbol, policy: t.policy })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Token Dashboard Card ───────────────────────────────────────────────────

function TokenCard({
  token, name, symbol, policy, config, onManage,
}: {
  token: Address; name: string; symbol: string; policy: number;
  config: ReturnType<typeof useConfig>; onManage: () => void;
}) {
  const [paused, setPaused] = useState<boolean | null>(null);

  useEffect(() => {
    tokenPaused(config, token).then(setPaused).catch(() => setPaused(null));
  }, [config, token]);

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-lg font-bold text-amber-700">
              {symbol.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900">{name}</span>
                <Badge variant="default">{symbol}</Badge>
                <Badge variant={policy === Policy.WhitelistAll ? "green" : "amber"}>
                  {policy === Policy.WhitelistAll ? "Whitelist all" : "Custom whitelist"}
                </Badge>
                {paused !== null && (
                  <Badge variant={paused ? "red" : "green"}>
                    {paused ? "⏸ Paused" : "● Live"}
                  </Badge>
                )}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                <AddressLink address={token} />
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={onManage} className="gap-2">
            Manage <ChevronRight size={14} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Create Token Wizard ────────────────────────────────────────────────────

function CreateTokenWizard({
  deployment, investors, onBack, onCreated,
}: {
  deployment: PlatformDeployment;
  investors: { address: Address; label?: string }[];
  onBack: () => void;
  onCreated: () => Promise<void>;
}) {
  const { address } = useAccount();
  const config = useConfig();
  const issueAction = useAction();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("Milan Office Building");
  const [symbol, setSymbol] = useState("MILAN");
  const [decimals, setDecimals] = useState("0");
  const [policy, setPolicy] = useState<Policy>(Policy.WhitelistAll);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  async function deploy() {
    if (!address) return;
    await issueAction.run(async () => {
      const custom = Object.entries(selected).filter(([, v]) => v).map(([k]) => k as Address);
      const { token } = await deployToken(config, address as Address, deployment, {
        name, symbol, decimals: Number(decimals), policy, customInvestors: custom,
      });
      await onCreated();
      return `Token deployed at ${token}.`;
    });
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="btn-ghost p-2 rounded-xl">
              <ArrowLeft size={16} />
            </button>
            <div>
              <CardTitle>Create New Token</CardTitle>
              <CardDescription>Deploy a security token on ERC-3643</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <Stepper steps={CREATE_STEPS} current={step} accent={ACCENT} />
        </div>
        <CardContent className="pt-6">

          {step === 0 && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-sm font-semibold text-slate-700">Step 1: Asset Details</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="label">Token / asset name</label>
                  <input className="input" placeholder="e.g. Milan Office Building" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="label">Symbol</label>
                  <input className="input" placeholder="e.g. MILAN" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
                </div>
                <div>
                  <label className="label">Decimals (0–18)</label>
                  <input className="input" value={decimals} onChange={(e) => setDecimals(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setStep(1)} disabled={!name.trim() || !symbol.trim()} style={{ backgroundColor: ACCENT }}>
                  Next <ChevronRight size={15} />
                </Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-sm font-semibold text-slate-700">Step 2: KYC / Whitelist Policy</p>
              <div className="space-y-3">
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all",
                    policy === Policy.WhitelistAll ? "border-amber-300 bg-amber-50" : "border-slate-200 hover:border-slate-300"
                  )}
                  onClick={() => setPolicy(Policy.WhitelistAll)}
                >
                  <input type="radio" checked={policy === Policy.WhitelistAll} onChange={() => setPolicy(Policy.WhitelistAll)} className="mt-1" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Whitelist All <Badge variant="green" className="ml-1">Recommended</Badge></p>
                    <p className="text-xs text-slate-500 mt-1">Every onboarded investor (now and in future) is eligible. Binds to the shared identity registry — 2 txs regardless of investor count.</p>
                  </div>
                </label>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all",
                    policy === Policy.WhitelistCustom ? "border-amber-300 bg-amber-50" : "border-slate-200 hover:border-slate-300"
                  )}
                  onClick={() => setPolicy(Policy.WhitelistCustom)}
                >
                  <input type="radio" checked={policy === Policy.WhitelistCustom} onChange={() => setPolicy(Policy.WhitelistCustom)} className="mt-1" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Custom Whitelist</p>
                    <p className="text-xs text-slate-500 mt-1">Only selected investors are eligible, registered into this token's own registry. You control each addition.</p>
                  </div>
                </label>

                {policy === Policy.WhitelistCustom && (
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs text-slate-500 mb-3 font-medium">Select eligible investors:</p>
                    {investors.length === 0 ? (
                      <p className="text-sm text-slate-400">No investors onboarded yet (use the KYC tab).</p>
                    ) : (
                      <div className="space-y-2">
                        {investors.map((inv) => (
                          <label key={inv.address} className="flex items-center gap-3 py-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!selected[inv.address]}
                              onChange={(e) => setSelected((s) => ({ ...s, [inv.address]: e.target.checked }))}
                              className="rounded"
                            />
                            {inv.label && <span className="text-sm font-medium text-slate-700">{inv.label}</span>}
                            <span className="mono text-slate-500">{shorten(inv.address)}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(0)}><ChevronLeft size={15} /> Back</Button>
                <Button onClick={() => setStep(2)} style={{ backgroundColor: ACCENT }}>Next <ChevronRight size={15} /></Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-sm font-semibold text-slate-700">Step 3: Deploy</p>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Summary</p>
                <Row label="Name" value={name} />
                <Row label="Symbol" value={symbol} />
                <Row label="Decimals" value={decimals} />
                <Row
                  label="Policy"
                  value={policy === Policy.WhitelistAll ? "Whitelist all investors" : `Custom (${Object.values(selected).filter(Boolean).length} selected)`}
                />
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                This will send ~6–8 blockchain transactions. Confirm each in your wallet.
                The token deploys paused — you can unpause it in the management view.
              </div>
              <StatusLine state={issueAction.state} message={issueAction.message} />
              {issueAction.state === "ok" ? (
                <SuccessBox>Token deployed successfully. Redirecting to dashboard…</SuccessBox>
              ) : (
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(1)}><ChevronLeft size={15} /> Back</Button>
                  <Button onClick={deploy} disabled={issueAction.pending} style={{ backgroundColor: ACCENT }}>
                    {issueAction.pending ? "Deploying…" : <><Zap size={14} /> Deploy Token</>}
                  </Button>
                </div>
              )}
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}

// ─── Token Manager ──────────────────────────────────────────────────────────

function TokenManager({
  token, name, symbol, policy, deployment, recipients, onBack,
}: {
  token: Address; name: string; symbol: string; policy: number;
  deployment: PlatformDeployment;
  recipients: { address: Address; label?: string }[];
  onBack: () => void;
}) {
  const { address } = useAccount();
  const config = useConfig();
  const action = useAction();
  const wlAction = useAction();
  const mintAction = useAction();
  const xferAction = useAction();
  const [roles, setRoles] = useState<TokenRoles | null>(null);
  const [paused, setPaused] = useState<boolean | null>(null);

  const CUSTOM = "__custom__";
  const [mintSel, setMintSel] = useState<string>(address ?? CUSTOM);
  const [mintCustom, setMintCustom] = useState("");
  const mintTo = mintSel === CUSTOM ? mintCustom : mintSel;
  const [mintAmt, setMintAmt] = useState("1000");
  const [xferTo, setXferTo] = useState("");
  const [xferAmt, setXferAmt] = useState("100");
  const [senderBal, setSenderBal] = useState<bigint | null>(null);
  const [balOf, setBalOf] = useState("");
  const [bal, setBal] = useState<string | null>(null);
  const [wlWallet, setWlWallet] = useState("");
  const [diag, setDiag] = useState<DiagItem[] | null>(null);
  const [diagBusy, setDiagBusy] = useState(false);

  async function loadState() {
    const [p, r, sb] = await Promise.all([
      tokenPaused(config, token),
      address ? getTokenRoles(config, deployment, token, address as Address).catch(() => null) : Promise.resolve(null),
      address ? balanceOf(config, token, address as Address).catch(() => null) : Promise.resolve(null),
    ]);
    setPaused(p);
    setRoles(r);
    setSenderBal(sb);
  }

  useEffect(() => { loadState(); }, [config, deployment, token, address]);

  async function runDiagnose() {
    if (!isAddress(mintTo)) return;
    setDiagBusy(true);
    try {
      const { items } = await diagnoseVerification(config, deployment, token, mintTo as Address);
      setDiag(items);
    } finally { setDiagBusy(false); }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="btn-ghost p-2 rounded-xl">
              <ArrowLeft size={16} />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle>{name}</CardTitle>
                <Badge variant="default">{symbol}</Badge>
                <Badge variant={policy === Policy.WhitelistAll ? "green" : "amber"}>
                  {policy === Policy.WhitelistAll ? "Whitelist all" : "Custom whitelist"}
                </Badge>
                {paused !== null && (
                  <Badge variant={paused ? "red" : "green"}>
                    {paused ? "⏸ Paused" : "● Live"}
                  </Badge>
                )}
              </div>
              <div className="mt-0.5 text-xs text-slate-400"><AddressLink address={token} /></div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs */}
      <Card>
        <CardContent className="pt-5">
          <Tabs defaultValue="overview">
            <TabsList className="w-full">
              <TabsTrigger value="overview" className="flex items-center gap-1.5">
                <LayoutDashboard size={13} /> Overview
              </TabsTrigger>
              <TabsTrigger value="mint" className="flex items-center gap-1.5">
                <Coins size={13} /> Mint
              </TabsTrigger>
              <TabsTrigger value="transfer" className="flex items-center gap-1.5">
                <ArrowRightLeft size={13} /> Transfer
              </TabsTrigger>
              {policy === Policy.WhitelistCustom && (
                <TabsTrigger value="whitelist" className="flex items-center gap-1.5">
                  <ShieldPlus size={13} /> Whitelist
                </TabsTrigger>
              )}
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Your Roles</p>
                    <div className="space-y-2">
                      <RoleLine label="Token agent (mint/burn)" ok={!!roles?.isTokenAgent} />
                      <RoleLine label="Registry agent (whitelist)" ok={!!roles?.isRegistryAgent} />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Token owner</span>
                        <span className="mono text-slate-600">{roles?.tokenOwner ? shorten(roles.tokenOwner) : "—"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Token Status</p>
                    <div className="flex items-center gap-2 mb-4">
                      {paused === null ? (
                        <span className="text-sm text-slate-400">Checking…</span>
                      ) : paused ? (
                        <>
                          <PauseCircle size={18} className="text-red-500" />
                          <span className="text-sm font-semibold text-red-600">Paused — transfers blocked</span>
                        </>
                      ) : (
                        <>
                          <PlayCircle size={18} className="text-emerald-500" />
                          <span className="text-sm font-semibold text-emerald-600">Live — transfers enabled</span>
                        </>
                      )}
                    </div>
                    {paused && (
                      <Button
                        size="sm"
                        disabled={action.pending}
                        style={{ backgroundColor: ACCENT }}
                        onClick={() => address && action.run(async () => {
                          await unpauseToken(config, address as Address, token);
                          await loadState();
                          return "Token unpaused — transfers are now enabled.";
                        })}
                      >
                        <PlayCircle size={14} /> Unpause Token
                      </Button>
                    )}
                    {paused === false && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={action.pending}
                        onClick={() => address && action.run(async () => {
                          // Pause is owner-only. We call it for completeness.
                          await unpauseToken(config, address as Address, token);
                          await loadState();
                          return "Action sent.";
                        })}
                      >
                        <PauseCircle size={14} /> Pause Token
                      </Button>
                    )}
                    <StatusLine state={action.state} message={action.message} />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input className="input" placeholder="Check balance of 0x…" value={balOf} onChange={(e) => setBalOf(e.target.value)} />
                  <Button
                    variant="outline"
                    disabled={!isAddress(balOf)}
                    onClick={async () => setBal((await balanceOf(config, token, balOf as Address)).toString())}
                  >
                    Check
                  </Button>
                  {bal !== null && <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">{bal} {symbol}</span>}
                </div>
              </div>
            </TabsContent>

            {/* Mint */}
            <TabsContent value="mint">
              <div className="space-y-4">
                <p className="text-sm text-slate-500">Recipient must be a verified investor — minting will revert otherwise.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Recipient</label>
                    <select className="input" value={mintSel} onChange={(e) => setMintSel(e.target.value)}>
                      {address && <option value={address}>My wallet (treasury) — {shorten(address)}</option>}
                      {recipients.filter((r) => r.address.toLowerCase() !== (address ?? "").toLowerCase()).map((r) => (
                        <option key={r.address} value={r.address}>
                          {r.label ? `${r.label} · ` : ""}{shorten(r.address)}
                        </option>
                      ))}
                      <option value={CUSTOM}>Custom address…</option>
                    </select>
                    {mintSel === CUSTOM && (
                      <input className="input mt-2" placeholder="0x…" value={mintCustom} onChange={(e) => setMintCustom(e.target.value)} />
                    )}
                  </div>
                  <div>
                    <label className="label">Amount</label>
                    <input className="input" value={mintAmt} onChange={(e) => setMintAmt(e.target.value)} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    title={roles && !roles.isTokenAgent ? "Your wallet is not a token agent for this token" : undefined}
                    disabled={mintAction.pending || !isAddress(mintTo) || (roles ? !roles.isTokenAgent : false)}
                    style={{ backgroundColor: ACCENT }}
                    onClick={() => address && mintAction.run(async () => {
                      await mintToken(config, address as Address, token, mintTo as Address, BigInt(mintAmt));
                      return `Minted ${mintAmt} ${symbol} to ${shorten(mintTo)}.`;
                    })}
                  >
                    <Coins size={14} /> {mintAction.pending ? "Minting…" : `Mint ${mintAmt} ${symbol}`}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={diagBusy || !isAddress(mintTo)}
                    onClick={runDiagnose}
                  >
                    {diagBusy ? "Checking…" : "Diagnose recipient"}
                  </Button>
                </div>

                {diag && (
                  <div className="rounded-xl border border-slate-200 p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Verification check</p>
                    {diag.map((it, i) => (
                      <div key={i} className={cn("flex items-start gap-2 text-sm", it.ok ? "text-emerald-700" : "text-red-600")}>
                        {it.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <XCircle size={14} className="mt-0.5 shrink-0" />}
                        <span>{it.label}{!it.ok && it.detail && <span className="block text-xs text-slate-500 pl-0">↳ {it.detail}</span>}</span>
                      </div>
                    ))}
                  </div>
                )}
                <StatusLine state={mintAction.state} message={mintAction.message} />
              </div>
            </TabsContent>

            {/* Transfer */}
            <TabsContent value="transfer">
              <div className="space-y-4">
                <p className="text-sm text-slate-500">Transfer will revert if the recipient is not a verified investor on this token.</p>
                {senderBal !== null && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2 text-sm flex items-center justify-between">
                    <span className="text-slate-500">Your balance</span>
                    <span className={senderBal === 0n ? "font-semibold text-red-500" : "font-semibold text-slate-800"}>
                      {senderBal.toString()} {symbol}
                      {senderBal === 0n && " — mint to your wallet first"}
                    </span>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Recipient address</label>
                    <input className="input" placeholder="0x…" value={xferTo} onChange={(e) => setXferTo(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Amount</label>
                    <input className="input" value={xferAmt} onChange={(e) => setXferAmt(e.target.value)} />
                  </div>
                </div>
                <Button
                  disabled={xferAction.pending || !isAddress(xferTo)}
                  style={{ backgroundColor: ACCENT }}
                  onClick={() => address && xferAction.run(async () => {
                    await transferToken(config, address as Address, token, xferTo as Address, BigInt(xferAmt));
                    return `Transferred ${xferAmt} ${symbol} to ${shorten(xferTo)}.`;
                  })}
                >
                  <ArrowRightLeft size={14} /> {xferAction.pending ? "Sending…" : `Transfer ${xferAmt} ${symbol}`}
                </Button>
                <StatusLine state={xferAction.state} message={xferAction.message} />
              </div>
            </TabsContent>

            {/* Whitelist (custom policy only) */}
            {policy === Policy.WhitelistCustom && (
              <TabsContent value="whitelist">
                <div className="space-y-4">
                  <p className="text-sm text-slate-500">Add an onboarded wallet to this token's custom whitelist. The wallet must already have a KYC identity.</p>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="label">Wallet address to whitelist</label>
                      <input className="input" placeholder="0x…" value={wlWallet} onChange={(e) => setWlWallet(e.target.value)} />
                    </div>
                    <div className="flex items-end">
                      <Button
                        title={roles && !roles.isRegistryAgent ? "Your wallet is not a registry agent for this token" : undefined}
                        disabled={wlAction.pending || !isAddress(wlWallet) || (roles ? !roles.isRegistryAgent : false)}
                        style={{ backgroundColor: ACCENT }}
                        onClick={() => address && wlAction.run(async () => {
                          await whitelistWalletOnToken(config, address as Address, deployment, token, wlWallet as Address, DEFAULT_COUNTRY);
                          setWlWallet("");
                          return `${shorten(wlWallet)} is now whitelisted for this token.`;
                        })}
                      >
                        <ShieldPlus size={14} /> {wlAction.pending ? "Whitelisting…" : "Whitelist"}
                      </Button>
                    </div>
                  </div>
                  <StatusLine state={wlAction.state} message={wlAction.message} />
                </div>
              </TabsContent>
            )}

          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function RoleLine({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      {ok
        ? <Badge variant="green"><CheckCircle2 size={10} /> Yes</Badge>
        : <Badge variant="default"><XCircle size={10} /> No</Badge>}
    </div>
  );
}

function BlockedCard({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-slate-400">{message}</CardContent>
    </Card>
  );
}
