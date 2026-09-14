import { readJsonFile } from "@/lib/store";
import type { CatalogSummary } from "@/lib/types";

const catalogFiles = [
  { id: "products", label: "商品", file: "products.json" },
  { id: "activities", label: "活动", file: "activities.json" },
  { id: "coupons", label: "优惠券", file: "coupons.json" },
  { id: "orders", label: "订单", file: "orders.json" },
  { id: "users", label: "用户", file: "users.json" },
  { id: "return-policies", label: "售后政策", file: "return-policies.json" },
  { id: "logistics", label: "物流", file: "logistics.json" },
  { id: "faq", label: "FAQ", file: "faq.json" },
  { id: "tickets", label: "工单", file: "tickets.json" },
  { id: "handoff-rules", label: "转人工规则", file: "handoff-rules.json" },
  { id: "runs", label: "运行记录", file: "runs.json" },
  { id: "eval_cases", label: "Eval 用例", file: "eval_cases.json" },
];

export async function getCatalogSummaries(): Promise<CatalogSummary[]> {
  return Promise.all(
    catalogFiles.map(async (item) => {
      const rows = await readJsonFile<unknown[]>(item.file, []);
      const sample = rows.slice(0, 3);
      const fields = collectFields(sample);

      return {
        ...item,
        count: rows.length,
        fields,
        sample,
      };
    }),
  );
}

function collectFields(rows: unknown[]) {
  const fields = new Set<string>();

  for (const row of rows) {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      for (const key of Object.keys(row)) {
        fields.add(key);
      }
    }
  }

  return [...fields].sort();
}
