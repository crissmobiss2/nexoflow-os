"use client";

import { useState, use } from "react";
import { api } from "@/lib/trpc/client";
import Link from "next/link";
import { ArrowLeft, ChevronRight, FileSignature, Loader2, Printer } from "lucide-react";
import { formatProjectType, formatDate } from "@/lib/utils";
import { renderMarkdown } from "@/lib/markdown";

export default function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [printing, setPrinting] = useState(false);
  const { data: proposal, isLoading } = api.projects.getProposal.useQuery({ id });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="p-8 max-w-5xl mx-auto text-center">
        <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>Project not found.</p>
        <Link href="/projects" className="text-sm hover:underline" style={{ color: "var(--brand-primary)" }}>
          ← Back to projects
        </Link>
      </div>
    );
  }

  if (!proposal.brief) {
    return (
      <div className="p-8 max-w-5xl mx-auto text-center">
        <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          This project doesn&apos;t have a brief yet. Complete the brief to generate a proposal.
        </p>
        <Link href={`/projects/${id}`} className="text-sm hover:underline" style={{ color: "var(--brand-primary)" }}>
          ← Back to project
        </Link>
      </div>
    );
  }

  const clientName = proposal.client?.name ?? proposal.client?.company ?? "Client";
  const projectName = proposal.name;
  const today = formatDate(new Date());
  const budgetLabel = proposal.budgetRange ?? "To be determined";
  const sortedPhases = [...proposal.phases].sort((a, b) => a.phaseOrder - b.phaseOrder);
  const totalWeeks = proposal.timelineWeeks;

  const printPDF = () => {
    setPrinting(true);
    // Small delay for UI feedback, then trigger print
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 300);
  };

  return (
    <>
      {/* ─── Print styles ──────────────────────────────────────────────── */}
      <style>{`
        @media print {
          @page {
            margin: 0.75in 0.85in;
            size: A4;
            @top-center {
              content: "NexoFlow OS — Proposal";
              font-size: 8px;
              color: #999;
              font-family: system-ui, sans-serif;
            }
            @bottom-center {
              content: "Page " counter(page) " of " counter(pages);
              font-size: 8px;
              color: #999;
              font-family: system-ui, sans-serif;
            }
          }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .proposal-doc {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            background: white !important;
            max-width: 100% !important;
          }
          .proposal-doc * { color: #1a1a2e !important; }
          .proposal-doc h1, .proposal-doc h2, .proposal-doc h3, .proposal-doc h4 { color: #0f0f23 !important; }
          .proposal-doc .section-title { color: #0f0f23 !important; border-bottom-color: #ddd !important; }
          .proposal-doc .text-muted-print { color: #555 !important; }
          .proposal-doc .signature-line { border-top-color: #333 !important; }
          .proposal-doc .phase-dot { color: #22c55e !important; }
          .proposal-doc .term-badge { background: #f0f0f5 !important; color: #333 !important; }
          .proposal-doc .payment-card { background: #f8f8fc !important; border-color: #ddd !important; }
          .proposal-doc td, .proposal-doc th { border-color: #ddd !important; }
          .proposal-doc th { background: #f0f0f5 !important; }
          .proposal-doc section { page-break-inside: avoid; }
          .proposal-doc section:not(:last-child) { page-break-after: auto; }
          .proposal-doc table { page-break-inside: avoid; }
          .proposal-doc .grid { page-break-inside: avoid; }
          .proposal-doc pre { white-space: pre-wrap !important; overflow: visible !important; max-height: none !important; }
          .proposal-header-print {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            margin-bottom: 32px !important;
            padding-bottom: 16px !important;
            border-bottom: 2px solid #e5e7eb !important;
          }
        }
        @media screen {
          .proposal-header-print { display: none; }
        }
      `}</style>

      <div className="p-8 max-w-5xl mx-auto">
        {/* ─── Navigation ─────────────────────────────────────────────── */}
        <div className="no-print flex items-center gap-2 mb-6 text-sm" style={{ color: "var(--text-secondary)" }}>
          <Link href={`/projects/${id}`} className="hover:opacity-80 flex items-center gap-1.5 transition-opacity">
            <ArrowLeft className="w-3.5 h-3.5" />
            {projectName}
          </Link>
          <ChevronRight className="w-3.5 h-3.5 opacity-40" />
          <span style={{ color: "var(--text-primary)" }}>Proposal</span>
        </div>

        {/* ─── Actions ────────────────────────────────────────────────── */}
        <div className="no-print flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              <FileSignature className="w-5 h-5 inline-block mr-2" style={{ color: "var(--brand-primary)" }} />
              Proposal Document
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Generated {today}
            </p>
          </div>
          <button
            onClick={printPDF}
            disabled={printing}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer disabled:opacity-60"
            style={{
              color: "var(--text-primary)",
              borderColor: "var(--surface-border)",
              background: "var(--brand-gradient)",
            }}
          >
            {printing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            {printing ? "Preparing PDF..." : "Download PDF"}
          </button>
        </div>

        {/* ─── Proposal Document ──────────────────────────────────────── */}
        <div
          className="proposal-doc rounded-xl p-10 md:p-14"
          style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
        >
          {/* Print-only branding header */}
          <div className="proposal-header-print">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#6366f1 !important", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              NexoFlow OS
            </span>
          </div>
          {/* Header */}
          <div className="text-center mb-10 pb-8" style={{ borderBottom: "2px solid var(--surface-border)" }}>
            <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
              {projectName}
            </h1>
            <p className="text-sm" style={{ color: "var(--brand-primary)" }}>
              {formatProjectType(proposal.projectType)}
              {proposal.industry ? ` · ${proposal.industry}` : ""}
            </p>
            <p className="text-xs mt-2 text-muted-print" style={{ color: "var(--text-muted)" }}>
              Prepared for <strong style={{ color: "var(--text-primary)" }}>{clientName}</strong>
              {" · "}{today}
            </p>
          </div>

          {/* Executive Summary */}
          <section className="mb-10">
            <h2 className="section-title text-base font-bold mb-4 pb-2" style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--surface-border)" }}>
              Executive Summary
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              <strong style={{ color: "var(--text-primary)" }}>{clientName}</strong> engaged NexoFlow to build{" "}
              <strong style={{ color: "var(--text-primary)" }}>{projectName}</strong>, a{" "}
              {formatProjectType(proposal.projectType).toLowerCase()}
              {proposal.industry ? ` for the ${proposal.industry} industry` : ""}.
              {proposal.brief.coreJobToBeDone ? (
                <>
                  {" "}The core job to be done is: <em style={{ color: "var(--text-primary)" }}>&ldquo;{proposal.brief.coreJobToBeDone}&rdquo;</em>.
                </>
              ) : ""}
            </p>
            {proposal.brief.targetUser && (
              <p className="text-sm leading-relaxed mt-3" style={{ color: "var(--text-secondary)" }}>
                <strong style={{ color: "var(--text-primary)" }}>Target Users:</strong> {proposal.brief.targetUser}
              </p>
            )}
            {proposal.brief.additionalContext && (
              <p className="text-sm leading-relaxed mt-3" style={{ color: "var(--text-secondary)" }}>
                <strong style={{ color: "var(--text-primary)" }}>Context:</strong> {proposal.brief.additionalContext}
              </p>
            )}
          </section>

          {/* Scope of Work */}
          <section className="mb-10">
            <h2 className="section-title text-base font-bold mb-4 pb-2" style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--surface-border)" }}>
              Scope of Work
            </h2>
            {proposal.scopeContent ? (
              <div className="text-sm leading-relaxed space-y-3">
                <p style={{ color: "var(--text-secondary)" }}>
                  The following scope of work outlines the deliverables, milestones, and technical
                  approach for <strong style={{ color: "var(--text-primary)" }}>{projectName}</strong>.
                </p>
                <div
                  className="prose-nexoflow mt-4"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(proposal.scopeContent) }}
                />
              </div>
            ) : (
              <p className="text-sm italic" style={{ color: "var(--text-muted)" }}>
                Scope document has not been generated yet. Generate a scope document first.
              </p>
            )}
          </section>

          {/* Timeline */}
          <section className="mb-10">
            <h2 className="section-title text-base font-bold mb-4 pb-2" style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--surface-border)" }}>
              Project Timeline
            </h2>
            {totalWeeks && (
              <p className="text-xs mb-4 text-muted-print" style={{ color: "var(--text-muted)" }}>
                Estimated duration: <strong style={{ color: "var(--text-primary)" }}>{totalWeeks} weeks</strong>
              </p>
            )}
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider px-3 py-2.5"
                    style={{ background: "var(--surface-elevated)", color: "var(--text-muted)", borderBottom: "1px solid var(--surface-border)" }}>
                    Phase
                  </th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider px-3 py-2.5"
                    style={{ background: "var(--surface-elevated)", color: "var(--text-muted)", borderBottom: "1px solid var(--surface-border)" }}>
                    Status
                  </th>
                  <th className="text-right text-xs font-semibold uppercase tracking-wider px-3 py-2.5"
                    style={{ background: "var(--surface-elevated)", color: "var(--text-muted)", borderBottom: "1px solid var(--surface-border)" }}>
                    Order
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedPhases.map((phase, idx) => (
                  <tr key={phase.id}>
                    <td className="px-3 py-3 text-sm" style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--surface-border)" }}>
                      <span className="phase-dot inline-block w-2 h-2 rounded-full mr-2"
                        style={{ background: phase.status === "completed" ? "var(--status-success)" : "var(--surface-border)" }}
                      />
                      {phase.phaseName}
                    </td>
                    <td className="px-3 py-3 text-xs" style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--surface-border)" }}>
                      {phase.status === "completed" ? (
                        <span style={{ color: "var(--status-success)" }}>Completed</span>
                      ) : phase.status === "in_progress" ? (
                        <span style={{ color: "var(--brand-primary)" }}>In Progress</span>
                      ) : phase.status === "skipped" ? (
                        <span className="text-muted-print" style={{ color: "var(--text-muted)" }}>Skipped</span>
                      ) : (
                        <span className="text-muted-print" style={{ color: "var(--text-muted)" }}>Pending</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-right" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--surface-border)" }}>
                      Phase {phase.phaseOrder + 1}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Pricing */}
          <section className="mb-10">
            <h2 className="section-title text-base font-bold mb-4 pb-2" style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--surface-border)" }}>
              Investment
            </h2>
            <div className="p-5 rounded-xl" style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)" }}>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Budget Range:{" "}
                <strong className="text-lg" style={{ color: "var(--brand-primary)" }}>
                  {budgetLabel}
                </strong>
              </p>
              {totalWeeks && (
                <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                  Estimated timeline: <strong style={{ color: "var(--text-primary)" }}>{totalWeeks} weeks</strong>
                  {budgetLabel !== "To be determined" && (
                    <> · Rate: approximately{" "}
                      <strong style={{ color: "var(--text-primary)" }}>
                        ${Math.round(parseInt(budgetLabel.replace(/[^0-9]/g, "")) / totalWeeks).toLocaleString()}/week
                      </strong>
                    </>
                  )}
                </p>
              )}
            </div>
          </section>

          {/* Payment Schedule */}
          <section className="mb-10">
            <h2 className="section-title text-base font-bold mb-4 pb-2" style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--surface-border)" }}>
              Payment Schedule
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "Upfront", pct: "30%", desc: "Due upon agreement signing", icon: "01" },
                { label: "Midpoint", pct: "40%", desc: "Due at project midpoint milestone", icon: "02" },
                { label: "Delivery", pct: "30%", desc: "Due upon final delivery & acceptance", icon: "03" },
              ].map(({ label, pct, desc, icon }) => (
                <div key={label}
                  className="payment-card rounded-xl p-4 text-center"
                  style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)" }}
                >
                  <div className="text-xs font-mono mb-2" style={{ color: "var(--text-muted)" }}>{icon}</div>
                  <div className="text-2xl font-bold" style={{ color: "var(--brand-primary)" }}>{pct}</div>
                  <div className="text-sm font-semibold mt-1" style={{ color: "var(--text-primary)" }}>{label}</div>
                  <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Terms & Conditions */}
          <section className="mb-10">
            <h2 className="section-title text-base font-bold mb-4 pb-2" style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--surface-border)" }}>
              Terms &amp; Conditions
            </h2>
            <div className="space-y-4 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              <div className="p-4 rounded-lg" style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)" }}>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Payment Terms</h3>
                <ul className="space-y-2">
                  <li className="flex gap-2">
                    <span className="term-badge shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: "hsl(220 90% 62% / 0.15)", color: "var(--brand-primary)" }}>30%
                    </span>
                    <span>Non-refundable upfront payment due upon signing this agreement to reserve the build slot and commence work.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="term-badge shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: "hsl(262 83% 68% / 0.15)", color: "var(--brand-accent)" }}>40%
                    </span>
                    <span>Milestone payment due upon delivery and client approval of the midpoint deliverable as defined in the scope of work.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="term-badge shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: "hsl(142 68% 52% / 0.15)", color: "var(--status-success)" }}>30%
                    </span>
                    <span>Final payment due upon project completion, delivery of all assets, and client sign-off.</span>
                  </li>
                </ul>
                <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
                  All invoices are <strong style={{ color: "var(--text-primary)" }}>Net-15</strong> — payment is due within 15 calendar days of the invoice date.
                  Late payments may incur a 1.5% monthly service charge on the outstanding balance.
                </p>
              </div>

              <div className="p-4 rounded-lg" style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)" }}>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Change Request Process</h3>
                <p className="text-sm">
                  Any changes to the agreed scope of work must be submitted in writing via a formal Change Request (CR).
                  Each CR will be assessed for impact on timeline and pricing. Changes increasing scope by more than
                  10% will require a revised budget estimate and may adjust the delivery schedule. Minor changes
                  (under 5 hours of effort) will be accommodated at no additional cost, at NexoFlow&apos;s discretion.
                </p>
              </div>

              <div className="p-4 rounded-lg" style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)" }}>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>General Terms</h3>
                <ul className="space-y-1.5 text-sm list-disc pl-4" style={{ color: "var(--text-secondary)" }}>
                  <li>Upon final payment, the client receives full intellectual property rights to the custom-built deliverables.</li>
                  <li>NexoFlow retains the right to display the project in its portfolio unless otherwise agreed in writing.</li>
                  <li>Either party may terminate the agreement with 14 days written notice. Fees for work completed up to the termination date remain payable.</li>
                  <li>All communication, code repositories, and design assets will be shared via NexoFlow&apos;s project management platform.</li>
                  <li>Post-launch support and maintenance are not included unless separately agreed in a support retainer agreement.</li>
                  <li>This proposal is valid for 30 days from the date above.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Signature Area */}
          <section>
            <h2 className="section-title text-base font-bold mb-6 pb-2" style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--surface-border)" }}>
              Acceptance &amp; Authorization
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              By signing below, the client acknowledges and agrees to the scope, timeline, pricing, and terms
              outlined in this proposal.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Client signature */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                  Client
                </p>
                <div className="mb-4">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{clientName}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{proposal.client?.email ?? ""}</p>
                </div>
                <div className="mb-3">
                  <div className="signature-line h-px w-full mb-1" style={{ borderTop: "1px dashed var(--surface-border)" }} />
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Signature</p>
                </div>
                <div>
                  <div className="signature-line h-px w-full mb-1" style={{ borderTop: "1px dashed var(--surface-border)" }} />
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Date</p>
                </div>
              </div>

              {/* NexoFlow signature */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                  NexoFlow
                </p>
                <div className="mb-4">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>NexoFlow Inc.</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>proposals@nexoflow.io</p>
                </div>
                <div className="mb-3">
                  <div className="signature-line h-px w-full mb-1" style={{ borderTop: "1px dashed var(--surface-border)" }} />
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Signature</p>
                </div>
                <div>
                  <div className="signature-line h-px w-full mb-1" style={{ borderTop: "1px dashed var(--surface-border)" }} />
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Date</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ─── Footer note ────────────────────────────────────────────── */}
        <p className="no-print text-xs text-center mt-8" style={{ color: "var(--text-muted)" }}>
          This proposal was generated by NexoFlow OS. Review all details before presenting to the client.
        </p>
      </div>
    </>
  );
}
