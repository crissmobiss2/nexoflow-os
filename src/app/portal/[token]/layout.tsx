export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "hsl(222, 30%, 5%)" }}
    >
      {/* Minimal header */}
      <header
        className="flex items-center gap-2 px-6 py-4 border-b shrink-0"
        style={{ borderColor: "hsl(222, 22%, 12%)" }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold"
          style={{ background: "var(--brand-gradient)" }}
        >
          N
        </div>
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          NexoFlow
        </span>
      </header>

      {/* Content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
