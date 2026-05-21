"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/trpc/client";
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react";

interface LineItem {
  description: string;
  quantity: number;
  rate: number;
}

function genInvoiceNumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 900) + 100);
  return `INV-${yy}${mm}-${rand}`;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [invoiceNumber, setInvoiceNumber] = useState(genInvoiceNumber());
  const [clientId, setClientId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [taxPct, setTaxPct] = useState(0);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: 1, rate: 0 },
  ]);

  const { data: clients } = api.clients.list.useQuery();
  const create = api.invoices.create.useMutation({
    onSuccess: (inv) => router.push(`/invoices/${inv.id}`),
  });

  function updateItem(i: number, field: keyof LineItem, value: string | number) {
    setLineItems((prev) =>
      prev.map((item, idx) => (idx === i ? { ...item, [field]: value } : item))
    );
  }

  function addItem() {
    setLineItems((prev) => [...prev, { description: "", quantity: 1, rate: 0 }]);
  }

  function removeItem(i: number) {
    setLineItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  const subtotalCents = lineItems.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.rate * 100),
    0
  );
  const taxCents = Math.round(subtotalCents * (taxPct / 100));
  const totalCents = subtotalCents + taxCents;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({
      invoiceNumber,
      clientId: clientId || null,
      status: "draft",
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      notes: notes || undefined,
      subtotal: subtotalCents,
      tax: taxCents,
      total: totalCents,
      lineItems: lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        rate: Math.round(item.rate * 100),
        amount: Math.round(item.quantity * item.rate * 100),
      })),
    });
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--surface-elevated)",
    border: "1px solid var(--surface-border)",
    borderRadius: "0.5rem",
    padding: "0.5rem 0.75rem",
    fontSize: "0.875rem",
    color: "var(--text-primary)",
    outline: "none",
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/invoices"
          className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Invoices
        </Link>
        <span style={{ color: "var(--text-muted)" }}>/</span>
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>New Invoice</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header fields */}
        <div
          className="rounded-2xl p-6 space-y-4"
          style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
        >
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Invoice Details
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Invoice Number
              </label>
              <input
                style={inputStyle}
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Client
              </label>
              <select
                style={{ ...inputStyle }}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">— No client —</option>
                {clients?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Due Date
              </label>
              <input
                type="date"
                style={inputStyle}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Tax %
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                style={inputStyle}
                value={taxPct}
                onChange={(e) => setTaxPct(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Line items */}
        <div
          className="rounded-2xl p-6 space-y-4"
          style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
        >
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Line Items
          </h2>
          <div className="space-y-3">
            {lineItems.map((item, i) => (
              <div key={i} className="grid gap-2" style={{ gridTemplateColumns: "1fr 80px 100px 36px" }}>
                <input
                  style={inputStyle}
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateItem(i, "description", e.target.value)}
                  required
                />
                <input
                  type="number"
                  min="1"
                  style={inputStyle}
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateItem(i, "quantity", Number(e.target.value))}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  style={inputStyle}
                  placeholder="Rate (£)"
                  value={item.rate}
                  onChange={(e) => updateItem(i, "rate", Number(e.target.value))}
                />
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  disabled={lineItems.length === 1}
                  className="flex items-center justify-center rounded-lg transition-opacity disabled:opacity-30"
                  style={{ border: "1px solid var(--surface-border)", color: "var(--status-error)" }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity"
            style={{ color: "var(--brand-primary)" }}
          >
            <Plus className="w-3.5 h-3.5" /> Add line item
          </button>

          {/* Totals */}
          <div className="pt-4 space-y-1.5" style={{ borderTop: "1px solid var(--surface-border)" }}>
            {[
              ["Subtotal", `£${(subtotalCents / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`],
              [`Tax (${taxPct}%)`, `£${(taxCents / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`],
              ["Total", `£${(totalCents / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span style={{ color: "var(--text-muted)" }}>{label}</span>
                <span className="font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div
          className="rounded-2xl p-6 space-y-3"
          style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
        >
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Notes
          </h2>
          <textarea
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
            placeholder="Payment terms, notes for client…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Link
            href="/invoices"
            className="px-4 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={create.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--brand-gradient)" }}
          >
            {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {create.isPending ? "Creating…" : "Create Invoice"}
          </button>
        </div>
      </form>
    </div>
  );
}
