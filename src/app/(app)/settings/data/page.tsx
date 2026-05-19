"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/trpc/client";
import JSZip from "jszip";
import {
  Database,
  Download,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  Shield,
  RefreshCw,
} from "lucide-react";

export default function DataPage() {
  const utils = api.useUtils();
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    totalImported: number;
    clients: { imported: number; skipped: number; errors: number };
    knowledge: { imported: number; skipped: number; errors: number };
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Record<string, number> | null>(null);
  const [conflictStrategy, setConflictStrategy] = useState<"skip" | "overwrite" | "merge">("skip");

  const [exportLoading, setExportLoading] = useState(false);
  const apiUtils = api.useUtils();

  // ─── Export ─────────────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportDone(false);
    try {
      const data = await exportMutation.mutateAsync();

      const zip = new JSZip();
      zip.file("clients.json", JSON.stringify(data.clients, null, 2));
      zip.file("projects.json", JSON.stringify(data.projects, null, 2));
      zip.file("knowledge.json", JSON.stringify(data.knowledge, null, 2));
      zip.file("invoices.json", JSON.stringify(data.invoices, null, 2));
      zip.file("sprintTasks.json", JSON.stringify(data.sprintTasks, null, 2));
      zip.file("_metadata.json", JSON.stringify({ exportedAt: data.exportedAt }, null, 2));

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nexoflow-export-${new Date().toISOString().split("T")[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportDone(true);
      setTimeout(() => setExportDone(false), 5000);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [exportMutation]);

  // ─── Import ─────────────────────────────────────────────────────────────────

  const importMutation = api.data.import.useMutation();

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportResult(null);
    setImportError(null);
    setPreview(null);

    try {
      const zip = await JSZip.loadAsync(file);
      const data: Record<string, unknown[]> = {};

      const expectedFiles = ["clients.json", "projects.json", "knowledge.json", "invoices.json", "sprintTasks.json"];
      for (const name of expectedFiles) {
        const zipFile = zip.file(name);
        if (zipFile) {
          const content = await zipFile.async("string");
          try {
            data[name.replace(".json", "")] = JSON.parse(content);
          } catch {
            setImportError(`Invalid JSON in ${name}`);
            return;
          }
        }
      }

      setPreview({
        clients: (data.clients ?? []).length,
        projects: (data.projects ?? []).length,
        knowledge: (data.knowledge ?? []).length,
        invoices: (data.invoices ?? []).length,
        sprintTasks: (data.sprintTasks ?? []).length,
      });

      // Auto-import
      setImporting(true);
      try {
        const result = await importMutation.mutateAsync({
          data: data as any,
          conflictStrategy,
        });
        setImportResult(result);
        void apiUtils.data.exportAll.invalidate();
      } catch (err: any) {
        setImportError(err.message ?? "Import failed");
      } finally {
        setImporting(false);
      }
    } catch {
      setImportError("Invalid ZIP file. Please upload a valid NexoFlow export.");
    }
  }, [importMutation, conflictStrategy, utils]);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-5 rounded-full" style={{ background: "var(--brand-gradient)" }} />
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Data Export &amp; Import</h1>
          </div>
          <p className="text-sm pl-3.5" style={{ color: "var(--text-secondary)" }}>
            Export all your data or import from a previous backup
          </p>
        </div>
      </div>

      {/* Export Section */}
      <div
        className="rounded-xl p-6 mb-6"
        style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "hsl(220 90% 62% / 0.15)" }}
          >
            <Download className="w-5 h-5" style={{ color: "var(--brand-primary)" }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Export All Data</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Download your data as a ZIP file with JSON files organized by table
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          {["clients.json", "projects.json", "knowledge.json", "invoices.json", "sprintTasks.json"].map((name) => (
            <div
              key={name}
              className="rounded-lg p-3 text-center"
              style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)" }}
            >
              <FileJson className="w-4 h-4 mx-auto mb-1" style={{ color: "var(--brand-primary)" }} />
              <div className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{name}</div>
            </div>
          ))}
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--brand-gradient)" }}
        >
          {exporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Exporting...
            </>
          ) : exportDone ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Exported!
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Export All Data
            </>
          )}
        </button>
      </div>

      {/* Import Section */}
      <div
        className="rounded-xl p-6"
        style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "hsl(142 68% 52% / 0.15)" }}
          >
            <Upload className="w-5 h-5" style={{ color: "hsl(142, 68%, 52%)" }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Import Data</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Upload a previously exported ZIP file to restore data
            </p>
          </div>
        </div>

        {/* Conflict strategy */}
        <div className="flex items-center gap-3 mb-4">
          <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            Conflict resolution:
          </label>
          <select
            value={conflictStrategy}
            onChange={(e) => setConflictStrategy(e.target.value as any)}
            className="text-xs rounded-lg px-3 py-1.5"
            style={{
              background: "var(--surface-elevated)",
              border: "1px solid var(--surface-border)",
              color: "var(--text-primary)",
            }}
          >
            <option value="skip">Skip existing</option>
            <option value="overwrite">Overwrite existing</option>
            <option value="merge">Merge (skip conflicts)</option>
          </select>
        </div>

        {/* File upload */}
        <label
          className="flex flex-col items-center justify-center gap-2 rounded-xl p-8 cursor-pointer transition-colors hover:opacity-80"
          style={{
            background: "var(--surface-elevated)",
            border: "2px dashed var(--surface-border)",
          }}
        >
          <Upload className="w-6 h-6" style={{ color: "var(--text-muted)" }} />
          <div>
            <p className="text-sm font-medium text-center" style={{ color: "var(--text-primary)" }}>
              Click to select a ZIP file
            </p>
            <p className="text-[11px] text-center mt-0.5" style={{ color: "var(--text-muted)" }}>
              Only NexoFlow export ZIP files are supported
            </p>
          </div>
          <input
            type="file"
            accept=".zip"
            onChange={handleFileSelect}
            className="hidden"
            disabled={importing}
          />
        </label>

        {/* Preview */}
        {preview && !importResult && !importing && (
          <div
            className="rounded-lg p-4 mt-4"
            style={{ background: "hsl(220 90% 62% / 0.08)", border: "1px solid hsl(220 90% 62% / 0.2)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4" style={{ color: "var(--brand-primary)" }} />
              <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                Import Preview
              </span>
            </div>
            <div className="space-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              {Object.entries(preview).map(([table, count]) => (
                <div key={table} className="flex justify-between">
                  <span>{table}</span>
                  <span className="font-mono">{count} records</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Importing */}
        {importing && (
          <div className="flex items-center gap-2 mt-4 text-sm" style={{ color: "var(--brand-primary)" }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            Importing data...
          </div>
        )}

        {/* Import Result */}
        {importResult && (
          <div
            className="rounded-lg p-4 mt-4"
            style={{ background: "hsl(142 68% 52% / 0.1)", border: "1px solid hsl(142 68% 52% / 0.25)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4" style={{ color: "hsl(142, 68%, 52%)" }} />
              <span className="text-sm font-semibold" style={{ color: "hsl(142, 68%, 52%)" }}>
                Import Complete
              </span>
            </div>
            <div className="space-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              <p>Total imported: <strong>{importResult.totalImported}</strong></p>
              <p>Clients: {importResult.clients.imported} imported, {importResult.clients.skipped} skipped, {importResult.clients.errors} errors</p>
              <p>Knowledge: {importResult.knowledge.imported} imported, {importResult.knowledge.skipped} skipped, {importResult.knowledge.errors} errors</p>
            </div>
          </div>
        )}

        {/* Import Error */}
        {importError && (
          <div
            className="rounded-lg p-4 mt-4"
            style={{ background: "hsl(0 80% 65% / 0.1)", border: "1px solid hsl(0 80% 65% / 0.25)" }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" style={{ color: "hsl(0, 80%, 65%)" }} />
              <span className="text-sm font-medium" style={{ color: "hsl(0, 80%, 65%)" }}>
                {importError}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
