"use client";

import { useState, useMemo } from "react";
import { useAccount, useConfig } from "wagmi";
import type { Address } from "viem";
import { useAction } from "./ui";
import { AddressLink } from "./AddressLink";
import { useDeployment } from "@/hooks/useDeployment";
import { useInvestors } from "@/hooks/useRegistry";
import { onboardInvestor, linkWalletToEntity, reissueClaim } from "@/lib/platform";
import { DEFAULT_COUNTRY } from "@/lib/constants";
import { isAddress, shorten } from "@/lib/format";
import { getLabel, setLabel } from "@/lib/labels";
import { groupByEntity } from "@/lib/entities";
import { Stepper } from "@/components/ui/stepper";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusLine, InfoBox } from "@/components/ui/status-line";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ShieldCheck, Upload, UserCheck, ChevronRight, ChevronLeft,
  FileText, Globe, User, CheckCircle2, Users, Link2, Plus, RefreshCw,
  Building2,
} from "lucide-react";

const ACCENT = "#059669";

const WIZARD_STEPS = [
  { label: "Investor Info" },
  { label: "Document Review" },
  { label: "Register" },
];

const DOC_TYPES = ["Passport", "National ID Card", "Driver's Licence", "Residence Permit"];
const ENTITY_DOC_TYPES = [
  "Certificate of Incorporation",
  "Company Register Extract",
  "Articles of Association",
  "Other",
];
const NATIONALITIES = [
  "Italian", "German", "French", "Spanish", "British",
  "American", "Swiss", "Dutch", "Swedish", "Japanese", "Other",
];
const JURISDICTIONS = [
  "Italy", "Germany", "France", "Spain", "United Kingdom",
  "United States", "Switzerland", "Netherlands", "Sweden", "Japan", "Other",
];

type EntityType = "person" | "entity";
type WizardView = "wizard" | "link" | null;

export function KycPanel() {
  const { address, isConnected } = useAccount();
  const config = useConfig();
  const { deployment, chainId } = useDeployment();
  const { investors, loading, refresh } = useInvestors(deployment);
  const onboardAction = useAction();
  const linkAction = useAction();
  const reissueAction = useAction();
  const [reissueTarget, setReissueTarget] = useState<string | null>(null);

  // wizard state
  const [view, setView] = useState<WizardView>(null);
  const [step, setStep] = useState(0);
  const [entityType, setEntityType] = useState<EntityType>("person");

  // step 1 — natural person fields (cosmetic)
  const [investorName, setInvestorName] = useState("");
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [nationality, setNationality] = useState(NATIONALITIES[0]);

  // step 1 — legal entity fields (cosmetic)
  const [companyName, setCompanyName] = useState("");
  const [jurisdiction, setJurisdiction] = useState(JURISDICTIONS[0]);
  const [lei, setLei] = useState("");
  const [entityDocType, setEntityDocType] = useState(ENTITY_DOC_TYPES[0]);

  // step 2 state (cosmetic)
  const [docUploaded, setDocUploaded] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanDone, setScanDone] = useState(false);

  // step 3 (real)
  const [wallet, setWallet] = useState("");
  const [country, setCountry] = useState(String(DEFAULT_COUNTRY));

  // link wallet state
  const [linkEntity, setLinkEntity] = useState("");
  const [linkWallet, setLinkWallet] = useState("");

  const entities = useMemo(
    () => groupByEntity(investors, (id) => getLabel(chainId, id)),
    [investors, chainId]
  );

  // Derived helpers — which doc type / name label to show depending on entity type
  const activeDocType = entityType === "person" ? docType : entityDocType;
  const activeName = entityType === "person" ? investorName : companyName;
  const nameLabel = entityType === "person" ? "Full name (off-chain label)" : "Company name (off-chain label)";
  const namePlaceholder = entityType === "person" ? "e.g. Alice Rossi" : "e.g. Meridian Capital S.r.l.";
  const step1Ready = activeName.trim() !== "";

  // Resets all wizard fields and the action state, but keeps the wizard open.
  // Used by "Onboard Another" so the user can start a new flow without re-opening the panel.
  function clearWizardFields() {
    setStep(0);
    setEntityType("person");
    setInvestorName("");
    setDocType(DOC_TYPES[0]);
    setNationality(NATIONALITIES[0]);
    setCompanyName("");
    setJurisdiction(JURISDICTIONS[0]);
    setLei("");
    setEntityDocType(ENTITY_DOC_TYPES[0]);
    setDocUploaded(false);
    setScanning(false);
    setScanDone(false);
    setWallet("");
    setCountry(String(DEFAULT_COUNTRY));
    onboardAction.reset();
  }

  function resetWizard() {
    clearWizardFields();
    setView(null);
  }

  function simulateScan() {
    setScanning(true);
    setScanDone(false);
    setTimeout(() => {
      setScanning(false);
      setScanDone(true);
    }, 1800);
  }

  async function onboard(primary: string) {
    if (!deployment || !address || !isAddress(primary)) return;
    await onboardAction.run(async () => {
      const identity = await onboardInvestor(config, address as Address, deployment, primary as Address, Number(country));
      if (activeName.trim()) setLabel(chainId, identity, activeName.trim());
      await refresh();
      setWallet("");
      return `${entityType === "entity" ? "Legal entity" : "Investor"} "${activeName.trim() || shorten(primary)}" successfully onboarded. Identity: ${identity}`;
    });
  }

  async function reissue(identity: string) {
    if (!deployment || !address) return;
    setReissueTarget(identity);
    await reissueAction.run(async () => {
      await reissueClaim(config, address as Address, deployment, identity as Address);
      return `KYC claim re-issued on identity ${shorten(identity)}.`;
    });
  }

  async function link() {
    if (!deployment || !address || !isAddress(linkWallet) || !linkEntity) return;
    await linkAction.run(async () => {
      await linkWalletToEntity(config, address as Address, deployment, linkEntity as Address, linkWallet as Address, Number(country));
      await refresh();
      setLinkWallet("");
      return `Wallet ${shorten(linkWallet)} linked — it now shares the same identity & KYC claim.`;
    });
  }

  if (!isConnected) return <BlockedCard message="Connect your wallet to use the KYC Service." />;
  if (!deployment) return <BlockedCard message="Deploy the platform infrastructure in the Admin tab first." />;

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Header card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ backgroundColor: "#ecfdf5" }}>
              <ShieldCheck size={20} style={{ color: ACCENT }} />
            </div>
            <div>
              <CardTitle>KYC Service</CardTitle>
              <CardDescription>Verify investors once per entity — extra wallets reuse the same identity & claim.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {view !== "wizard" && (
              <Button onClick={() => { setView("wizard"); setStep(0); }} className="gap-2" style={{ backgroundColor: ACCENT }}>
                <Plus size={15} /> Onboard New Investor
              </Button>
            )}
            {view !== "link" && entities.length > 0 && (
              <Button variant="outline" onClick={() => setView("link")} className="gap-2">
                <Link2 size={15} /> Link Wallet to Existing Entity
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── KYC Wizard ── */}
      {view === "wizard" && (
        <Card className="overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">New Investor Onboarding</h3>
              <button onClick={resetWizard} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
                Cancel
              </button>
            </div>
            <Stepper steps={WIZARD_STEPS} current={step} accent={ACCENT} />
          </div>

          <CardContent className="pt-6">
            {/* Step 1 — Investor Information */}
            {step === 0 && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-1">Step 1: Investor Information</p>
                  <p className="text-xs text-slate-400">Details are stored off-chain only (never on the blockchain).</p>
                </div>

                {/* Entity type toggle */}
                <div>
                  <label className="label mb-2">Entity type</label>
                  <div className="grid grid-cols-2 gap-2 max-w-xs">
                    <button
                      onClick={() => setEntityType("person")}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border p-3 text-sm font-medium transition-all",
                        entityType === "person"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      )}
                    >
                      <User size={14} /> Natural Person
                    </button>
                    <button
                      onClick={() => setEntityType("entity")}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border p-3 text-sm font-medium transition-all",
                        entityType === "entity"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      )}
                    >
                      <Building2 size={14} /> Legal Entity
                    </button>
                  </div>
                </div>

                <InfoBox>
                  <b>Privacy note:</b> real identity data is never stored on-chain — a public ledger is incompatible with GDPR.
                  The KYC provider keeps this data in a secure off-chain database. In this PoC, labels are stored only in your browser.
                </InfoBox>

                {/* Natural Person fields */}
                {entityType === "person" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label">
                        <User size={11} className="inline mr-1" />{nameLabel}
                      </label>
                      <input className="input" placeholder={namePlaceholder} value={investorName} onChange={(e) => setInvestorName(e.target.value)} />
                    </div>
                    <div>
                      <label className="label">
                        <Globe size={11} className="inline mr-1" />Nationality
                      </label>
                      <select className="input" value={nationality} onChange={(e) => setNationality(e.target.value)}>
                        {NATIONALITIES.map((n) => <option key={n}>{n}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">
                        <FileText size={11} className="inline mr-1" />Identity document type
                      </label>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {DOC_TYPES.map((d) => (
                          <button
                            key={d}
                            onClick={() => setDocType(d)}
                            className={cn(
                              "rounded-xl border p-3 text-sm font-medium text-left transition-all",
                              docType === d
                                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                            )}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Legal Entity fields */}
                {entityType === "entity" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label">
                        <Building2 size={11} className="inline mr-1" />{nameLabel}
                      </label>
                      <input className="input" placeholder={namePlaceholder} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                    </div>
                    <div>
                      <label className="label">
                        <Globe size={11} className="inline mr-1" />Jurisdiction
                      </label>
                      <select className="input" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>
                        {JURISDICTIONS.map((j) => <option key={j}>{j}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">
                        <FileText size={11} className="inline mr-1" />LEI / Registration number (optional)
                      </label>
                      <input
                        className="input"
                        placeholder="e.g. 549300ABCDEF123456 or IT-MI-12345"
                        value={lei}
                        onChange={(e) => setLei(e.target.value)}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">
                        <FileText size={11} className="inline mr-1" />Corporate document type
                      </label>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {ENTITY_DOC_TYPES.map((d) => (
                          <button
                            key={d}
                            onClick={() => setEntityDocType(d)}
                            className={cn(
                              "rounded-xl border p-3 text-sm font-medium text-left transition-all",
                              entityDocType === d
                                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                            )}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button onClick={() => setStep(1)} disabled={!step1Ready} style={{ backgroundColor: ACCENT }}>
                    Next <ChevronRight size={15} />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2 — Document Upload (mock) */}
            {step === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-1">Step 2: Document Upload & Verification</p>
                  <p className="text-xs text-slate-400">Upload the {entityType === "entity" ? "entity's" : "investor's"} {activeDocType} for verification.</p>
                </div>

                <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  {!docUploaded ? (
                    <>
                      <Upload size={32} className="mx-auto mb-3 text-slate-300" />
                      <p className="text-sm font-medium text-slate-600">Drag &amp; drop {activeDocType} here</p>
                      <p className="text-xs text-slate-400 mt-1">or</p>
                      <Button variant="outline" className="mt-3" onClick={() => { setDocUploaded(true); simulateScan(); }}>
                        Select File (mock)
                      </Button>
                    </>
                  ) : scanning ? (
                    <>
                      <div className="mx-auto mb-3 h-10 w-10 rounded-full border-4 border-emerald-200 border-t-emerald-500 animate-spin" />
                      <p className="text-sm font-medium text-slate-700">Scanning document…</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {entityType === "entity" ? "Running registry & sanctions checks" : "Running biometric & liveness checks"}
                      </p>
                    </>
                  ) : scanDone ? (
                    <>
                      <CheckCircle2 size={36} className="mx-auto mb-3 text-emerald-500" />
                      <p className="text-sm font-semibold text-emerald-700">Document verified</p>
                      <div className="mt-3 flex flex-wrap justify-center gap-2">
                        {entityType === "entity" ? (
                          <>
                            <Badge variant="green">Document authentic ✓</Badge>
                            <Badge variant="green">Registry check ✓</Badge>
                            <Badge variant="green">No sanctions match ✓</Badge>
                          </>
                        ) : (
                          <>
                            <Badge variant="green">Identity match ✓</Badge>
                            <Badge variant="green">Liveness check ✓</Badge>
                            <Badge variant="green">No sanctions match ✓</Badge>
                          </>
                        )}
                      </div>
                    </>
                  ) : null}
                </div>

                {scanDone && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Verification summary</p>
                    <div className="space-y-1 text-sm">
                      {entityType === "person" ? (
                        <>
                          <div className="flex justify-between"><span className="text-slate-500">Investor</span><span className="font-medium text-slate-800">{investorName}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Document</span><span className="font-medium text-slate-800">{docType}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Nationality</span><span className="font-medium text-slate-800">{nationality}</span></div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between"><span className="text-slate-500">Company</span><span className="font-medium text-slate-800">{companyName}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Document</span><span className="font-medium text-slate-800">{entityDocType}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Jurisdiction</span><span className="font-medium text-slate-800">{jurisdiction}</span></div>
                          {lei && <div className="flex justify-between"><span className="text-slate-500">LEI / Reg. No.</span><span className="font-medium text-slate-800">{lei}</span></div>}
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(0)}><ChevronLeft size={15} /> Back</Button>
                  <Button onClick={() => setStep(2)} disabled={!scanDone} style={{ backgroundColor: ACCENT }}>
                    Approve &amp; Continue <ChevronRight size={15} />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3 — Blockchain Registration */}
            {step === 2 && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-1">Step 3: Register on Blockchain</p>
                  <p className="text-xs text-slate-400">Create an on-chain identity &amp; KYC claim for this {entityType === "entity" ? "legal entity" : "investor"}.</p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">KYC Approval for</p>
                  <div className="space-y-1 text-sm">
                    {entityType === "person" ? (
                      <>
                        <div className="flex justify-between"><span className="text-slate-500">Investor</span><span className="font-medium text-slate-800">{investorName}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Document</span><span className="font-medium text-slate-800">{docType}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Nationality</span><span className="font-medium text-slate-800">{nationality}</span></div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between"><span className="text-slate-500">Company</span><span className="font-medium text-slate-800">{companyName}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Document</span><span className="font-medium text-slate-800">{entityDocType}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Jurisdiction</span><span className="font-medium text-slate-800">{jurisdiction}</span></div>
                        {lei && <div className="flex justify-between"><span className="text-slate-500">LEI / Reg. No.</span><span className="font-medium text-slate-800">{lei}</span></div>}
                      </>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">
                      {entityType === "entity" ? "Representative wallet address" : "Investor wallet address"}
                    </label>
                    <input
                      className="input"
                      placeholder="0x…"
                      value={wallet}
                      onChange={(e) => setWallet(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Country code (ISO 3166-1 numeric)</label>
                    <input
                      className="input"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                    />
                  </div>
                </div>

                {address && (
                  <button
                    className="text-xs text-emerald-600 hover:underline"
                    onClick={() => setWallet(address)}
                  >
                    Use my connected wallet ({shorten(address)})
                  </button>
                )}

                <StatusLine state={onboardAction.state} message={onboardAction.message} />

                {onboardAction.state === "ok" ? (
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={resetWizard}>Done</Button>
                    <Button onClick={clearWizardFields} style={{ backgroundColor: ACCENT }}>
                      Onboard Another
                    </Button>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setStep(1)}><ChevronLeft size={15} /> Back</Button>
                    <Button
                      onClick={() => onboard(wallet)}
                      disabled={onboardAction.pending || !isAddress(wallet)}
                      style={{ backgroundColor: ACCENT }}
                    >
                      {onboardAction.pending ? "Registering…" : "Register on Blockchain"}
                      {!onboardAction.pending && <UserCheck size={15} />}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Link Wallet ── */}
      {view === "link" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Link Additional Wallet</CardTitle>
                <CardDescription>Attach a new wallet to an existing entity — no new KYC required.</CardDescription>
              </div>
              <button onClick={() => setView(null)} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
                Cancel
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Existing entity</label>
                <select className="input" value={linkEntity} onChange={(e) => setLinkEntity(e.target.value)}>
                  <option value="">Select an entity…</option>
                  {entities.map((en) => (
                    <option key={en.identity} value={en.identity}>
                      {en.label ? `${en.label} ` : ""}({shorten(en.identity)}) · {en.wallets.length} wallet(s)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">New wallet address</label>
                <input className="input" placeholder="0x…" value={linkWallet} onChange={(e) => setLinkWallet(e.target.value)} />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                onClick={link}
                disabled={linkAction.pending || !isAddress(linkWallet) || !linkEntity}
                style={{ backgroundColor: ACCENT }}
              >
                {linkAction.pending ? "Linking…" : "Link Wallet"}
                <Link2 size={14} />
              </Button>
            </div>
            <StatusLine state={linkAction.state} message={linkAction.message} />
          </CardContent>
        </Card>
      )}

      {/* ── Onboarded entities list ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-slate-400" />
              <CardTitle>Onboarded Investors ({entities.length})</CardTitle>
            </div>
            <button className="text-sm text-slate-400 hover:text-slate-700 transition-colors" onClick={refresh}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {entities.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
              No investors onboarded yet. Use the button above to start.
            </div>
          ) : (
            <div className="space-y-2">
              {entities.map((en) => (
                <div key={en.identity} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full text-white text-xs font-bold"
                      style={{ backgroundColor: ACCENT }}>
                      {(en.label ?? "?")[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">
                        {en.label || <span className="text-slate-400 font-normal">(unlabeled)</span>}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span>Identity:</span><AddressLink address={en.identity} />
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-wrap items-center gap-1 justify-end">
                    <Badge variant="green">{en.wallets.length} wallet{en.wallets.length !== 1 ? "s" : ""}</Badge>
                    {en.wallets.map((w) => (
                      <span key={w} className="hidden sm:inline-flex">
                        <Badge variant="default"><AddressLink address={w} /></Badge>
                      </span>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => reissue(en.identity)}
                      disabled={reissueAction.pending}
                      title="Re-issue KYC claim (use if onboarding left the claim missing)"
                    >
                      <RefreshCw size={12} className={reissueAction.pending && reissueTarget === en.identity ? "animate-spin" : ""} />
                      Re-issue claim
                    </Button>
                  </div>
                </div>
              ))}
              <StatusLine state={reissueAction.state} message={reissueAction.message} />
            </div>
          )}
        </CardContent>
      </Card>

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
