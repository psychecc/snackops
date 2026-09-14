import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const toneClass: Record<BadgeTone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  success: "border-[#8ec8a8] bg-[#edf8f2] text-success",
  warning: "border-[#efc071] bg-[#fff4df] text-[#805114]",
  danger: "border-[#e5a19b] bg-[#fff1ef] text-danger",
  info: "border-[#9fc5d1] bg-[#edf7fa] text-[#225766]",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
        toneClass[tone],
        className,
      )}
      {...props}
    />
  );
}
