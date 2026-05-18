"use client";

import { use, useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/trpc/client";
import {
  ArrowLeft, Zap, Download, Copy, Check, Loader2,
  ChevronRight, ChevronDown, FileCode2, FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import JSZip from "jszip";

// Parses ```filepath:path/to/file.ts\n...\n``` blocks from Claude's output
function parseFiles(content: string): Array<{ path: string; code: string; lang: string }> {
  const regex = /```filepath:([^\n]+)\n([\s\S]*?)```/g;
  const files: Array<{ path: string; code: string; lang: string }> = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const path = match[1]?.trim() ?? "";
    const code = match[2] ?? "";
    const ext = path.split(".").pop() ?? "";
    const langMap: Record<string, string> = {
      ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
      json: "json", md: "markdown", css: "css", html: "html",
      rs: "rust", toml: "toml", yaml: "yaml", yml: "yaml", sh: "bash",
    };
    files.push({ path, code, lang: langMap[ext] ?? "text" });
  }
  return files;
}

function FileTree({
  files,
  selected,
  onSelect,
}: {
  files: Array<{ path: string }>;
  selected: string;
  onSelect: (path: string) => void;
}) {
  // Build tree structure
  type TreeNode = { name: string; path: string; children: Record<string, TreeNode>; isFile: boolean };
  const root: TreeNode = { name: "", path: "", children: {}, isFile: false };

  for (const f of files) {
    const parts = f.path.split("/");
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i] ?? "";
      if (!node.children[part]) {
        const partPath = parts.slice(0, i + 1).join("/");
        node.children[part] = { name: part, path: partPath, children: {}, isFile: i === parts.length - 1 };
      }
      node = node.children[part]!;
    }
  }

  function renderNode(node: TreeNode, depth = 0): React.ReactNode {
    const children = Object.values(node.children).sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
    });

    return children.map((child) => (
      <div key={child.path}>
        {child.isFile ? (
          <button
            onClick={() => onSelect(child.path)}
            className={cn(
              "w-full text-left flex items-center gap-1.5 py-1 px-2 rounded text-xs transition-colors",
              selected === child.path
                ? "bg-[hsl(220,90%,62%,0.15)] text-[var(--brand-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]",
            )}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            <FileCode2 className="w-3.5 h-3.5 shrink-0 opacity-60" />
            {child.name}
          </button>
        ) : (
          <div>
            <div
              className="flex items-center gap-1.5 py-1 px-2 text-xs text-[var(--text-muted)] font-medium"
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              <FolderOpen className="w-3.5 h-3.5 shrink-0" />
              {child.name}
            </div>
            {renderNode(child, depth + 1)}
          </div>
        )}
      </div>
    ));
  }

  return <div className="py-2">{renderNode(root)}</div>;
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative h-full">
      <button
        onClick={copy}
        className="absolute top-3 right-3 z-10 p-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-400" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-white/60" />
        )}
      </button>
      <pre className="h-full overflow-auto p-5 text-sm leading-relaxed text-[hsl(220,15%,85%)] bg-[hsl(220,20%,10%)] font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function GeneratePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: project } = api.projects.get.useQuery({ id });

  const [status, setStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [rawOutput, setRawOutput] = useState("");
  const [files, setFiles] = useState<Array<{ path: string; code: string; lang: string }>>([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const streamRef = useRef<string>("");
  const outputRef = useRef<HTMLDivElement>(null);

  // Check if already generated
  useEffect(() => {
    if (!project) return;
    const existing = project.artifacts.find((a) => a.artifactType === "code_bundle");
    if (existing) {
      const parsed = parseFiles(existing.content);
      setFiles(parsed);
      setRawOutput(existing.content);
      setSelectedFile(parsed[0]?.path ?? "");
      setStatus("done");
    }
  }, [project]);

  const startGeneration = useCallback(async () => {
    setStatus("generating");
    setRawOutput("");
    streamRef.current = "";
    setFiles([]);

    try {
      const res = await fetch(`/api/generate/${id}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response body");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6)) as {
              text?: string;
              done?: boolean;
              error?: string;
            };
            if (data.error) throw new Error(data.error);
            if (data.text) {
              streamRef.current += data.text;
              setRawOutput(streamRef.current);
              // Parse files incrementally
              const parsed = parseFiles(streamRef.current);
              if (parsed.length > 0) {
                setFiles(parsed);
                if (!selectedFile && parsed[0]) setSelectedFile(parsed[0].path);
              }
            }
            if (data.done) {
              setStatus("done");
              const finalFiles = parseFiles(streamRef.current);
              setFiles(finalFiles);
              if (finalFiles[0]) setSelectedFile(finalFiles[0].path);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Generation failed");
      setStatus("error");
    }
  }, [id, selectedFile]);

  const downloadZip = async () => {
    const zip = new JSZip();
    for (const f of files) {
      zip.file(f.path, f.code);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.name ?? "project"}-boilerplate.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedFileData = files.find((f) => f.path === selectedFile);
  const hasArch = project?.artifacts.some((a) => a.artifactType === "architecture");

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--surface-border)", background: "var(--surface-card)" }}>
        <div className="flex items-center gap-4">
          <Link
            href={`/projects/${id}`}
            className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="w-4 h-4" />
            {project?.name ?? "Back"}
          </Link>
          <ChevronRight className="w-4 h-4 text-[var(--surface-border)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">Code Generation</span>
        </div>

        <div className="flex items-center gap-3">
          {status === "done" && files.length > 0 && (
            <button
              onClick={() => void downloadZip()}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-lg transition-colors"
              style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)", background: "var(--surface-elevated)" }}
            >
              <Download className="w-4 h-4" />
              Download ZIP ({files.length} files)
            </button>
          )}

          {status === "idle" && (
            <button
              onClick={() => void startGeneration()}
              disabled={!hasArch}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "var(--brand-gradient)" }}
            >
              <Zap className="w-4 h-4" />
              Generate Code
            </button>
          )}

          {status === "generating" && (
            <div className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg text-sm font-semibold opacity-80">
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </div>
          )}

          {status === "done" && (
            <button
              onClick={() => { setStatus("idle"); setFiles([]); setRawOutput(""); setSelectedFile(""); }}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors"
              style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)", background: "var(--surface-elevated)" }}
            >
              Regenerate
            </button>
          )}
        </div>
      </div>

      {/* Not ready state */}
      {!hasArch && status === "idle" && (
        <div className="flex flex-col items-center justify-center flex-1 text-center p-8">
          <div className="w-14 h-14 rounded-2xl bg-[hsl(220,90%,56%,0.08)] flex items-center justify-center mb-5">
            <Zap className="w-7 h-7 text-[var(--brand-primary)]" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            Architecture required first
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-sm">
            Generate the architecture document before generating code. This gives Claude the full system design to work from.
          </p>
          <Link
            href={`/projects/${id}`}
            className="px-4 py-2.5 bg-[var(--brand-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brand-primary-hover)] transition-colors"
          >
            ← Back to project
          </Link>
        </div>
      )}

      {/* Ready to generate */}
      {hasArch && status === "idle" && (
        <div className="flex flex-col items-center justify-center flex-1 text-center p-8">
          <div className="w-14 h-14 rounded-2xl bg-[hsl(220,90%,56%,0.08)] flex items-center justify-center mb-5">
            <Zap className="w-7 h-7 text-[var(--brand-primary)]" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            Ready to generate
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-sm">
            Claude will read the scope and architecture documents then generate production-ready boilerplate using NexoFlow's engineering standards.
          </p>
          <button
            onClick={() => void startGeneration()}
            className="flex items-center gap-2 px-6 py-3 bg-[var(--brand-primary)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--brand-primary-hover)] transition-colors"
          >
            <Zap className="w-4 h-4" />
            Generate Code
          </button>
        </div>
      )}

      {/* Streaming view */}
      {status === "generating" && files.length === 0 && (
        <div className="flex-1 overflow-auto p-6 font-mono text-sm bg-[hsl(220,20%,10%)] text-[hsl(220,15%,75%)]">
          <div ref={outputRef} className="max-w-4xl mx-auto whitespace-pre-wrap leading-relaxed">
            {rawOutput || (
              <span className="text-[hsl(220,15%,45%)]">
                Connecting to Claude claude-sonnet-4-6…
              </span>
            )}
            <span className="inline-block w-2 h-4 bg-[var(--brand-primary)] ml-0.5 animate-pulse" />
          </div>
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <div className="flex flex-col items-center justify-center flex-1 p-8 text-center">
          <p className="text-[var(--status-error)] font-medium mb-2">Generation failed</p>
          <p className="text-sm text-[var(--text-secondary)] mb-4">{errorMsg}</p>
          <button
            onClick={() => setStatus("idle")}
            className="px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg text-sm font-medium"
          >
            Try again
          </button>
        </div>
      )}

      {/* File explorer + code viewer */}
      {(status === "done" || (status === "generating" && files.length > 0)) && (
        <div className="flex flex-1 overflow-hidden">
          {/* File tree sidebar */}
          <aside className="w-56 shrink-0 overflow-auto" style={{ borderRight: "1px solid var(--surface-border)", background: "var(--surface-card)" }}>
            <div className="px-3 py-2.5 border-b border-[var(--surface-border)]">
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                {files.length} file{files.length !== 1 ? "s" : ""} generated
              </span>
            </div>
            <FileTree files={files} selected={selectedFile} onSelect={setSelectedFile} />
          </aside>

          {/* Code panel */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {selectedFileData ? (
              <>
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[hsl(220,20%,14%)] bg-[hsl(220,20%,12%)]">
                  <span className="text-xs font-mono text-[hsl(220,15%,65%)]">
                    {selectedFileData.path}
                  </span>
                  <span className="text-xs text-[hsl(220,15%,45%)]">
                    {selectedFileData.lang}
                  </span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <CodeBlock code={selectedFileData.code} lang={selectedFileData.lang} />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center flex-1 bg-[hsl(220,20%,10%)]">
                <p className="text-sm text-[hsl(220,15%,45%)]">Select a file to view</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
