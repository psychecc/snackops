import { CatalogBrowser } from "@/components/catalog-browser";
import { Badge } from "@/components/ui/badge";
import { getCatalogSummaries } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const summaries = await getCatalogSummaries();

  return (
    <div className="grid gap-5">
      <section className="ops-panel p-5">
        <Badge tone="info">Business Data</Badge>
        <h1 className="mt-3 text-2xl font-black">业务数据目录</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          按数据类型查看商品、活动、优惠券、订单、用户、售后政策、FAQ、物流和工单摘要。
        </p>
      </section>
      <CatalogBrowser summaries={summaries} />
    </div>
  );
}
