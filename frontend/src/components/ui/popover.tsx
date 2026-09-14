import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Minimal popover: a trigger button + an absolutely-positioned panel. */
export function Popover({
  trigger,
  children,
  align = "start",
  className,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}>
        {trigger}
      </button>
      {open && (
        <div
          className={cn(
            "absolute z-40 mt-1.5 rounded-xl border border-border bg-card p-2.5 shadow-2xl",
            align === "end" ? "right-0" : "left-0",
            className,
          )}
          style={{ animation: "pop-in 0.15s ease-out" }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
