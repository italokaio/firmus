import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-gradient-to-b from-background to-muted/40 px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at top, color-mix(in oklch, var(--primary) 12%, transparent), transparent 60%)",
        }}
      />
      {children}
    </div>
  );
}
