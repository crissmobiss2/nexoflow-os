"use client";

import { useState, useRef, useCallback } from "react";
import { Play, Copy, X, Loader2, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodeSandboxProps {
  code: string;
  language: string;
  sandboxEnabled: boolean;
}

type SandboxStatus = "idle" | "running" | "success" | "error";

export function CodeSandbox({ code, language, sandboxEnabled }: CodeSandboxProps) {
  const [status, setStatus] = useState<SandboxStatus>("idle");
  const [output, setOutput] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const canRun = sandboxEnabled && (language === "javascript" || language === "js" || language === "typescript" || language === "ts" || language === "html");

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleRun = useCallback(() => {
    if (!canRun) return;
    setStatus("running");
    setOutput("");

    // Create a sandboxed iframe to execute code
    const iframe = iframeRef.current;
    if (!iframe) {
      setStatus("error");
      setOutput("Sandbox iframe not available");
      return;
    }

    let sandboxContent = "";
    if (language === "html") {
      sandboxContent = code;
    } else {
      // JavaScript/TypeScript: wrap in a minimal HTML page
      sandboxContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Sandbox</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 16px; background: #0d1117; color: #c9d1d9; }
    pre { white-space: pre-wrap; word-break: break-word; }
    .error { color: #f85149; }
    .log { color: #c9d1d9; }
  </style>
</head>
<body>
<pre id="output"></pre>
<script>
  (function() {
    const output = document.getElementById('output');
    const logs = [];
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = function(...args) {
      logs.push('<span class="log">' + args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ') + '</span>');
      output.innerHTML = logs.join('\\n');
    };
    console.error = function(...args) {
      logs.push('<span class="error">' + args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ') + '</span>');
      output.innerHTML = logs.join('\\n');
    };
    console.warn = function(...args) {
      logs.push('<span class="error">' + args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ') + '</span>');
      output.innerHTML = logs.join('\\n');
    };

    try {
      ${code}
    } catch (e) {
      logs.push('<span class="error">' + e.toString() + '</span>');
      output.innerHTML = logs.join('\\n');
    }
  })();
</script>
</body>
</html>`;
    }

    // Set timeout to kill execution after 5 seconds
    const timeoutId = setTimeout(() => {
      setStatus("error");
      setOutput("Execution timed out after 5 seconds");
      if (iframe.srcdoc) {
        iframe.srcdoc = "<html><body><p style='color:#f85149;font-family:sans-serif;padding:16px;'>Execution timed out</p></body></html>";
      }
    }, 5000);

    // Listen for messages from the iframe (not used currently, but available for extension)
    const messageHandler = (event: MessageEvent) => {
      if (event.source === iframe.contentWindow) {
        // Handle any postMessage from sandbox if needed
      }
    };
    window.addEventListener("message", messageHandler);

    // Set the iframe content
    iframe.srcdoc = sandboxContent;
    iframe.onload = () => {
      clearTimeout(timeoutId);
      // We can't directly get console output across iframes due to sandbox,
      // but the output is rendered inside the iframe itself
      setStatus("success");
      window.removeEventListener("message", messageHandler);
    };

    // Fallback: after a short delay, check if we have any output
    setTimeout(() => {
      if (status === "running") {
        setStatus("success");
        setOutput("Code executed — see result in sandbox iframe above");
        clearTimeout(timeoutId);
        window.removeEventListener("message", messageHandler);
      }
    }, 1000);
  }, [code, language, canRun, status]);

  const handleClear = useCallback(() => {
    setOutput("");
    setStatus("idle");
    if (iframeRef.current) {
      iframeRef.current.srcdoc = "";
    }
  }, []);

  return (
    <div className="mt-2 rounded-xl overflow-hidden" style={{ border: "1px solid var(--surface-border)" }}>
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-3 py-2" style={{ background: "var(--surface-elevated)", borderBottom: "1px solid var(--surface-border)" }}>
        <Terminal className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          {language.toUpperCase()}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {canRun && (
            <button
              onClick={handleRun}
              disabled={status === "running"}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all disabled:opacity-50"
              style={{
                background: status === "running" ? "hsl(142, 68%, 52%, 0.1)" : "hsl(142, 68%, 52%, 0.15)",
                color: "hsl(142, 68%, 52%)",
              }}
            >
              {status === "running" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              {status === "running" ? "Running…" : "Run ▶"}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all"
            style={{
              background: copied ? "hsl(142, 68%, 52%, 0.15)" : "var(--surface-card)",
              color: copied ? "hsl(142, 68%, 52%)" : "var(--text-muted)",
            }}
          >
            <Copy className="w-3 h-3" />
            {copied ? "Copied!" : "Copy"}
          </button>
          {(status === "success" || status === "error") && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all"
              style={{ color: "var(--text-muted)" }}
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Code display */}
      <pre
        className="text-sm leading-relaxed overflow-x-auto p-4 m-0"
        style={{
          background: "hsl(222, 25%, 6%)",
          color: "var(--text-primary)",
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: "12px",
          lineHeight: "1.6",
        }}
      >
        <code>{code}</code>
      </pre>

      {/* Sandbox iframe (hidden by default, shown during/after execution) */}
      {(status === "running" || status === "success") && (
        <div
          className="border-t overflow-hidden"
          style={{ borderColor: "var(--surface-border)" }}
        >
          <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ background: "hsl(222, 25%, 4%)", borderBottom: "1px solid var(--surface-border)" }}>
            <Terminal className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
            <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Output</span>
            {status === "running" && (
              <Loader2 className="w-2.5 h-2.5 animate-spin ml-1" style={{ color: "hsl(142, 68%, 52%)" }} />
            )}
          </div>
          <iframe
            ref={iframeRef}
            title="code-sandbox"
            sandbox="allow-scripts"
            className="w-full border-0"
            style={{
              background: "#0d1117",
              minHeight: "60px",
              maxHeight: "300px",
            }}
          />
        </div>
      )}

      {/* Text output (for non-JS or fallback) */}
      {output && (
        <div
          className="border-t px-4 py-3 text-xs font-mono leading-relaxed"
          style={{
            borderColor: "var(--surface-border)",
            background: "hsl(222, 25%, 6%)",
            color: "var(--text-secondary)",
            whiteSpace: "pre-wrap",
            maxHeight: "200px",
            overflow: "auto",
          }}
        >
          {output}
        </div>
      )}
    </div>
  );
}

/**
 * Parse code blocks from AI response markdown and wrap them with sandbox data
 */
export function parseCodeBlocks(markdown: string): Array<{
  language: string;
  code: string;
  index: number;
}> {
  const blocks: Array<{ language: string; code: string; index: number }> = [];
  const regex = /```(\w+)?\s*\n([\s\S]*?)```/g;
  let match;
  let index = 0;

  while ((match = regex.exec(markdown)) !== null) {
    const language = (match[1] ?? "text").toLowerCase();
    const code = match[2]!.trim();
    blocks.push({ language, code, index });
    index++;
  }

  return blocks;
}

/**
 * Split markdown content into segments of text and code blocks
 */
export function splitMarkdownIntoSegments(markdown: string): Array<{
  type: "text" | "code";
  content: string;
  language?: string;
  code?: string;
}> {
  const segments: Array<{
    type: "text" | "code";
    content: string;
    language?: string;
    code?: string;
  }> = [];
  const regex = /```(\w+)?\s*\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(markdown)) !== null) {
    // Text before this code block
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: markdown.slice(lastIndex, match.index),
      });
    }

    const language = (match[1] ?? "text").toLowerCase();
    const code = match[2]!.trim();

    segments.push({
      type: "code",
      content: match[0],
      language,
      code,
    });

    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last code block
  if (lastIndex < markdown.length) {
    segments.push({
      type: "text",
      content: markdown.slice(lastIndex),
    });
  }

  return segments;
}
