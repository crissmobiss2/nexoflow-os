"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";
import { formatDate } from "@/lib/utils";
import {
  ArrowLeft, Download, Trash2, Loader2, Banknote,
  Clock, CheckCircle2, Send,
} from "lucide-react";

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  draft:     { label: "Draft",     color: "hsl(220, 20%, 50%)", bg: "hsl(220, 20%, 50%, 0.10)", border: "hsl(220, 20%, 50%, 0.2)" },
  sent:      { label: "Sent",      color: "hsl(207, 70%, 60%)", bg: "hsl(207, 90%, 60%, 0.12)", border: "hsl(207, 70%, 60%, 0.25)" },
  paid:      { label: "Paid",      color: "hsl(142, 68%, 52%)", bg: "hsl(142, 68%, 52%, 0.12)", border: "hsl(142, 68%, 52%, 0.25)" },
  overdue:   { label: "Overdue",   color: "hsl(0, 80%, 60%)",   bg: "hsl(0, 80%, 60%, 0.12)",   border: "hsl(0, 80%, 60%, 0.25)" },
  cancelled: { label: "Cancelled", color: "hsl(220, 10%, 45%)", bg: "hsl(220, 10%, 45%, 0.10)", border: "hsl(220, 10%, 45%, 0.2)" },
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-sm" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-6 space-y-4"
      style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{title}</h3>
      {children}
    </div>
  );
}

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: invoice, refetch, isLoading } = api.invoices.get.useQuery({ id });
  const deleteInvoice = api.invoices.delete.useMutation({
    onSuccess: () => router.push("/invoices"),
  });
  const generatePdf = api.invoices.generatePdf.useMutation();
  const updateStatus = api.invoices.update.useMutation({
    onSuccess: () => void refetch(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Invoice not found.</p>
        <Link href="/invoices" className="text-sm mt-2 inline-block hover:underline" style={{ color: "var(--brand-primary)" }}>
          ← Back to invoices
        </Link>
      </div>
    );
  }

  const statusBadge = (STATUS_BADGE[invoice.status] ?? STATUS_BADGE.draft)!;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/invoices"
            className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
            style={{ color: "var(--text-secondary)" }}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Invoices
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {/* Status actions */}
          {invoice.status === "draft" && (
            <button
              onClick={() => updateStatus.mutate({ id, status: "sent" })}
              disabled={updateStatus.isPending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-80"
              style={{ background: "hsl(207, 70%, 60%, 0.12)", color: "hsl(207, 70%, 60%)", border: "1px solid hsl(207, 70%, 60%, 0.25)" }}
            >
              <Send className="w-3.5 h-3.5" /> Mark Sent
            </button>
          )}
          {invoice.status === "sent" && (
            <button
              onClick={() => updateStatus.mutate({ id, status: "paid", paidDate: new Date().toISOString() })}
              disabled={updateStatus.isPending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-80"
              style={{ background: "hsl(142, 68%, 52%, 0.12)", color: "hsl(142, 68%, 52%)", border: "1px solid hsl(142, 68%, 52%, 0.25)" }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Mark Paid
            </button>
          )}
          <button
            onClick={() => generatePdf.mutate({ id })}
            disabled={generatePdf.isPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}
          >
            <Download className="w-3.5 h-3.5" /> {generatePdf.isPending ? "Generating..." : "PDF"}
          </button>
          <button
            onClick={() => { if (confirm("Delete this invoice?")) deleteInvoice.mutate({ id }); }}
            disabled={deleteInvoice.isPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
            style={{ color: "var(--status-error)", border: "1px solid var(--surface-border)" }}
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>

      {/* Invoice header */}
      <div
        className="rounded-2xl p-6"
        style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: "hsl(220 90% 62% / 0.12)" }}
            >
              <Banknote className="w-6 h-6" style={{ color: "var(--brand-primary)" }} />
            </div>
            <div>
              <h1 className="text-xl font-bold font-mono" style={{ color: "var(--text-primary)" }}>
                {invoice.invoiceNumber}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                  style={{ background: statusBadge.bg, color: statusBadge.color, border: `1px solid ${statusBadge.border}` }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {statusBadge.label}
                </span>
                {invoice.client && (
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    · {invoice.client.name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
              £{(invoice.total / 100).toLocaleString()}
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              VAT: £{(invoice.tax / 100).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          {/* Line Items */}
          <Section title="Line Items">
            {invoice.lineItems.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No line items added.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--surface-border)" }}>
                      <th className="text-left py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Description</th>
                      <th className="text-right py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Qty</th>
                      <th className="text-right py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Rate</th>
                      <th className="text-right py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.lineItems.map((item) => (
                      <tr key={item.id} style={{ borderBottom: "1px solid var(--surface-border-subtle)" }}>
                        <td className="py-2.5" style={{ color: "var(--text-primary)" }}>{item.description}</td>
                        <td className="py-2.5 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>{item.quantity}</td>
                        <td className="py-2.5 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>£{(item.rate / 100).toLocaleString()}</td>
                        <td className="py-2.5 text-right tabular-nums font-semibold" style={{ color: "var(--text-primary)" }}>£{(item.amount / 100).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="pt-3 text-right text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Subtotal</td>
                      <td className="pt-3 text-right text-sm tabular-nums font-semibold" style={{ color: "var(--text-primary)" }}>£{(invoice.subtotal / 100).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="pt-1 text-right text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Tax</td>
                      <td className="pt-1 text-right text-sm tabular-nums font-semibold" style={{ color: "var(--text-primary)" }}>£{(invoice.tax / 100).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="pt-2 text-right text-sm font-bold" style={{ color: "var(--text-primary)", borderTop: "2px solid var(--surface-border)" }}>Total</td>
                      <td className="pt-2 text-right text-lg font-bold tabular-nums" style={{ color: "var(--text-primary)", borderTop: "2px solid var(--surface-border)" }}>£{(invoice.total / 100).toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Section>

          {/* Notes */}
          {invoice.notes && (
            <Section title="Notes">
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{invoice.notes}</p>
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Section title="Details">
            <div className="space-y-3">
              <InfoRow label="Invoice Number" value={invoice.invoiceNumber} />
              <InfoRow label="Client" value={invoice.client?.name} />
              <InfoRow label="Client Email" value={invoice.client?.email} />
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Due Date</span>
                <span className="text-sm" style={{ color: invoice.status === "overdue" ? "var(--status-error)" : "var(--text-primary)" }}>
                  {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
                </span>
              </div>
              {invoice.paidDate && (
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3" style={{ color: "var(--status-success)" }} />
                  <span className="text-xs" style={{ color: "var(--status-success)" }}>
                    Paid on {formatDate(invoice.paidDate)}
                  </span>
                </div>
              )}
              <InfoRow label="Created" value={invoice.createdAt ? formatDate(invoice.createdAt) : undefined} />
              {invoice.author && <InfoRow label="Created by" value={invoice.author.name ?? invoice.author.email} />}
            </div>
          </Section>

          {generatePdf.data && (
            <Section title="Generated Content">
              <pre
                className="text-xs leading-relaxed whitespace-pre-wrap max-h-60 overflow-auto rounded-lg p-3"
                style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)" }}
              >
                {generatePdf.data.pdf}
              </pre>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
