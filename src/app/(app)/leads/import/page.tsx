"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/trpc/client";
import { ArrowLeft, Upload, FileText, Loader2, CheckCircle2, AlertCircle, X, Copy } from "lucide-react";
import { parseCsv, mapLeadRow, dedupKey } from "@/lib/csv";

const ALL_COLUMNS = [
  "firstName", "lastName", "email", "phone", "company", "website",
  "industry", "companySize", "region", "jobTitle", "linkedIn",
  "techStack", "painPoints", "scrapedData", "notes",
];

export default function ImportLeadsPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [rawCount, setRawCount] = useState(0);
  const [internalDupes, setInternalDupes] = useState(0);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  const importMutation = api.leads.importBulk.useMutation({
    onSuccess: (result) => {
      const params = new URLSearchParams({
        imported: String(result.count),
        skipped: String(result.skipped),
      });
      router.push(`/leads?${params.toString()}`);
    },
    onError: (err) => setError(err.message),
  });

  function handleFile(file: File) {
    setError("");
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const raw = parseCsv(text);
        setRawCount(raw.length);
        const mapped = raw.map(mapLeadRow);

        // De-duplicate within the file itself
        const seen = new Set<string>();
        const deduped: Record<string, string>[] = [];
        let dupes = 0;
        for (const row of mapped) {
          const key = dedupKey(row);
          if (seen.has(key)) { dupes++; continue; }
          seen.add(key);
          deduped.push(row);
        }
        setInternalDupes(dupes);
        setPreview(deduped);
      } catch (err) {
        setError(`Failed to parse CSV: ${err instanceof Error ? err.message : "unknown"}`);
      }
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type === "text/csv" || file?.name.endsWith(".csv")) handleFile(file);
    else setError("Please drop a CSV file.");
  }

  function handleImport() {
    if (preview.length === 0) return;
    const rows = preview.map((r) => ({
      firstName: r.firstName || undefined,
      lastName: r.lastName || undefined,
      email: r.email || undefined,
      phone: r.phone || undefined,
      company: r.company || undefined,
      website: r.website || undefined,
      industry: r.industry || undefined,
      companySize: r.companySize || undefined,
      region: r.region || undefined,
      jobTitle: r.jobTitle || undefined,
      linkedIn: r.linkedIn || undefined,
      techStack: r.techStack || undefined,
      painPoints: r.painPoints || undefined,
      scrapedData: r.scrapedData || undefined,
      notes: r.notes || undefined,
    }));
    importMutation.mutate({ rows, skipDuplicates });
  }

  const hasMappedColumns = preview.length > 0 && preview[0] && Object.keys(preview[0]).length > 0;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/leads" className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-3.5 h-3.5" /> Leads
        </Link>
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Import CSV</span>
      </div>

      {preview.length === 0 && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:opacity-80"
          style={{ border: "2px dashed var(--surface-border)", background: "var(--surface-card)" }}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="w-10 h-10 mb-4" style={{ color: "var(--brand-primary)" }} />
          <h2 className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Drop your CSV here</h2>
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            or click to browse. RFC-4180 compliant: handles quoted commas &amp; line breaks.
          </p>
          <div className="text-xs space-y-1" style={{ color: "var(--text-muted)" }}>
            <div>Recognized columns: <span style={{ color: "var(--text-secondary)" }}>{ALL_COLUMNS.join(", ")}</span></div>
            <div className="opacity-70">Also accepts: name, full_name, organization, sector, tel, mobile…</div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      )}

      {error && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl mt-4 text-sm"
          style={{ background: "hsl(0 70% 60% / 0.1)", border: "1px solid hsl(0 70% 60% / 0.3)", color: "hsl(0, 70%, 60%)" }}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {preview.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" style={{ color: "var(--brand-primary)" }} />
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{fileName}</span>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: "hsl(220 90% 62% / 0.12)", color: "var(--brand-primary)" }}
              >
                {preview.length} rows
              </span>
              {internalDupes > 0 && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: "hsl(35 90% 60% / 0.12)", color: "hsl(35, 90%, 60%)" }}
                  title="Rows with duplicate email/website/company inside this CSV"
                >
                  <Copy className="w-3 h-3 inline mr-1" />
                  {internalDupes} dupe{internalDupes === 1 ? "" : "s"} removed
                </span>
              )}
            </div>
            <button
              onClick={() => { setPreview([]); setFileName(""); setError(""); setRawCount(0); setInternalDupes(0); }}
              className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
              style={{ color: "var(--text-muted)" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--surface-border)" }}>
                    {Object.keys(preview[0] ?? {}).map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left font-semibold uppercase tracking-wider"
                        style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 5).map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--surface-border-subtle)" }}>
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="px-4 py-2.5 max-w-[150px] truncate" style={{ color: "var(--text-secondary)" }}>
                          {val || <span style={{ color: "var(--text-muted)" }}>—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {preview.length > 5 && (
                    <tr>
                      <td
                        colSpan={Object.keys(preview[0] ?? {}).length}
                        className="px-4 py-2.5 text-center"
                        style={{ color: "var(--text-muted)" }}
                      >
                        +{preview.length - 5} more rows…
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {hasMappedColumns && (
            <div className="flex flex-col gap-2">
              <div
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                style={{ background: "hsl(142 68% 52% / 0.1)", border: "1px solid hsl(142 68% 52% / 0.3)", color: "hsl(142, 68%, 52%)" }}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {Object.keys(preview[0] ?? {}).length} columns mapped · ready to import {preview.length} leads
                {rawCount !== preview.length && ` (${rawCount} parsed, ${rawCount - preview.length} duplicates removed)`}
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none" style={{ color: "var(--text-secondary)" }}>
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="w-4 h-4"
                />
                Skip leads that already exist (matched by email or website)
              </label>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Link
              href="/leads"
              className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}
            >
              Cancel
            </Link>
            <button
              onClick={handleImport}
              disabled={importMutation.isPending || !hasMappedColumns}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--brand-gradient)" }}
            >
              {importMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Import {preview.length} Leads
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
