"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="ops-panel p-6">
      <div className="max-w-2xl">
        <p className="text-sm font-bold text-danger">错误状态</p>
        <h1 className="mt-2 text-2xl font-black">运营数据加载失败</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Button className="mt-5" onClick={reset}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          重试
        </Button>
      </div>
    </section>
  );
}
