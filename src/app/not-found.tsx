import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="ops-panel p-6">
      <p className="text-sm font-bold text-danger">错误状态：页面不存在</p>
      <h1 className="mt-2 text-2xl font-black">找不到这个运营视图</h1>
      <Button asChild className="mt-5">
        <Link href="/">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          返回
        </Link>
      </Button>
    </section>
  );
}
