"use client";

import { api } from "@/lib/trpc/client";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import {
  Plus, ArrowRight, FileText, Loader2, Clock, Banknote,
} from "lucide-react";

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: "Draft",     color: "hsl(220, 20%, 50%)", bg: "hsl(220, 20%, 50%, 0.12)" },
  sent:      { label: "Sent",      color: "hsl(207, 70%, 60%)", bg: "hsl(207, 90%, 60%, 0.12)" },
  paid:      { label: "Paid",      color: "hsl(142, 68%, 52%)", bg: "hsl(142, 68%, 52%, 0.12)" },
  overdue:   { label: "Overdue",   color: "hsl(0, 80%, 60%)",   bg: "hsl(0, 80%, 60%, 0.12)" },
  cancelled: { label: "Cancelled", color: "hsl(220, 10%, 45%)", bg: "hsl(220, 10%, 45%, 0.10)" },
};

export default function InvoicesPage() {
  const { data: invoices, isLoading } = api.invoices.list.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-5 rounded-full" style={{ background: "var(--brand-gradient)" }} />
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Invoices</h1>
          </div>
          <p className="text-sm pl-3.5" style={{ color: "var(--text-secondary)" }}>
            {invoices?.length ?? 0} invoice{(invoices?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/invoices/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--brand-gradient)" }}
        >
          <Plus className="w-4 h-4" /> New Invoice
        </Link>
      </div>

      {!invoices || invoices.length === 0 ? (
        <div
          className="rounded-2xl flex flex-col items-center justify-center py-24 text-center"
          style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: "hsl(220 90% 62% / 0.1)" }}
          >
            <Banknote className="w-6 h-6" style={{ color: "var(--brand-primary)" }} />
          </div>
          <h2 className="text-base font-semibold mb-2" style={{ color: "var(--text-primary)" }}>No invoices yet</h2>
          <p className="text-sm mb-6 max-w-xs" style={{ color: "var(--text-secondary)" }}>
            Create your first invoice to start tracking billing and payments.
          </p>
          <Link
            href="/invoices/new"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Plus className="w-4 h-4" /> Create invoice
          </Link>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
        >
          {/* Column headers */}
          <div
            className="grid px-6 py-3"
            style={{
              borderBottom: "1px solid var(--surface-border)",
              gridTemplateColumns: "120px 1fr 100px 120px 100px 16px",
              gap: "1rem",
            }}
          >
            {["Invoice #", "Client", "Status", "Due Date", "Amount", ""].map((h) => (
              <div key={h} className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                {h}
              </div>
            ))}
          </div>

          {invoices.map((invoice) => {
            const statusStyle = STATUS_STYLE[invoice.status] ?? STATUS_STYLE.draft!;
            return (
              <Link
                key={invoice.id}
                href={`/invoices/${invoice.id}`}
                className="grid items-center px-6 py-4 transition-colors hover:bg-white/[0.02] group"
                style={{
                  borderBottom: "1px solid var(--surface-border-subtle)",
                  gridTemplateColumns: "120px 1fr 100px 120px 100px 16px",
                  gap: "1rem",
                }}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                  <span className="text-sm font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
                    {invoice.invoiceNumber}
                  </span>
                </div>

                <div className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
                  {invoice.client?.name ?? <span style={{ color: "var(--text-muted)" }}>—</span>}
                </div>

                <div>
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: statusStyle.bg, color: statusStyle.color }}
                  >
                    {statusStyle.label}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs" style={{ color: invoice.status === "overdue" ? "var(--status-error)" : "var(--text-secondary)" }}>
                  {invoice.dueDate ? (
                    <>
                      <Clock className="w-3 h-3" />
                      {formatDate(invoice.dueDate)}
                    </>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </div>

                <div className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                  £{(invoice.total / 100).toLocaleString()}
                </div>

                <ArrowRight className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
