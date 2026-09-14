import { z } from "zod";
import {
  couponSchema,
  orderSchema,
  productSchema,
  promotionSchema,
  toolSchema,
  userSchema,
  type Coupon,
  type Product,
  type Promotion,
  type Tool,
  type ToolRunResult,
} from "@/lib/types";
import { readJsonFile, updateJsonFile } from "@/lib/store";

const TOOLS_FILE = "tools.json";

type ToolHandler = (input: unknown) => Promise<unknown>;

const queryProductsInputSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  flavor: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(50).default(10),
});

const queryActivitiesInputSchema = z.object({
  productIds: z.array(z.string()).optional(),
  at: z.string().optional(),
});

const queryCouponsInputSchema = z.object({
  userId: z.string().optional(),
  productIds: z.array(z.string()).optional(),
  subtotal: z.number().nonnegative().optional(),
  at: z.string().optional(),
});

const calculatePriceInputSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive().default(1),
  userId: z.string().optional(),
  couponId: z.string().optional(),
  at: z.string().optional(),
});

const queryOrdersInputSchema = z.object({
  orderId: z.string().optional(),
  orderNo: z.string().optional(),
  userId: z.string().optional(),
});

const queryLogisticsInputSchema = z.object({
  orderId: z.string().optional(),
  orderNo: z.string().optional(),
  region: z.string().optional(),
});

const handlers: Record<string, ToolHandler> = {
  query_products: queryProducts,
  query_activities: queryActivities,
  query_coupons: queryCoupons,
  calculate_price: calculatePrice,
  query_orders: queryOrders,
  query_logistics: queryLogistics,
};

export async function listTools() {
  const tools = await readJsonFile<unknown[]>(TOOLS_FILE, []);
  return tools.map((tool) => toolSchema.parse(tool));
}

export async function listEnabledTools() {
  const tools = await listTools();
  return tools.filter((tool) => tool.enabled);
}

export async function getTool(id: string) {
  const tools = await listTools();
  return tools.find((tool) => tool.id === id) ?? null;
}

export async function updateToolEnabled(id: string, enabled: boolean) {
  const updated = await updateJsonFile<Tool[]>(
    TOOLS_FILE,
    (tools) =>
      tools.map((tool) => {
        const parsed = toolSchema.parse(tool);
        return parsed.id === id ? { ...parsed, enabled } : parsed;
      }),
    [],
  );

  return updated.find((tool) => tool.id === id) ?? null;
}

export async function runToolTest(id: string, input?: unknown): Promise<ToolRunResult> {
  const startedAt = Date.now();
  const tool = await getTool(id);
  const handler = handlers[id];
  const effectiveInput = input ?? tool?.testInput ?? {};

  if (!tool) {
    return createToolError(id, effectiveInput, `Tool not found: ${id}`);
  }

  if (!handler) {
    return createToolError(id, effectiveInput, `Tool handler not implemented: ${id}`);
  }

  try {
    const output = await handler(effectiveInput);
    return {
      ok: true,
      toolId: id,
      input: effectiveInput,
      output,
      durationMs: Date.now() - startedAt,
      executedAt: new Date().toISOString(),
    };
  } catch (error) {
    return createToolError(id, effectiveInput, getErrorMessage(error), Date.now() - startedAt);
  }
}

async function queryProducts(input: unknown) {
  const parsed = queryProductsInputSchema.parse(input);
  const products = await readProducts();
  const query = parsed.query?.trim().toLowerCase();
  const tags = parsed.tags ?? [];

  const results = products
    .map((product) => {
      const haystack = [
        product.name,
        product.brand,
        product.category,
        product.categoryName,
        product.description,
        ...product.flavors,
        ...product.tags,
        ...product.ingredients,
      ]
        .join(" ")
        .toLowerCase();

      if (query && !haystack.includes(query)) {
        return null;
      }

      if (parsed.category && product.category !== parsed.category) {
        return null;
      }

      if (parsed.flavor && !product.flavors.includes(parsed.flavor)) {
        return null;
      }

      if (tags.length > 0 && !tags.some((tag) => product.tags.includes(tag))) {
        return null;
      }

      const reasons: string[] = [];
      let score = 0;

      if (query) {
        score += query ? 4 : 1;
        reasons.push(`命中关键词：${parsed.query}`);
      }

      if (!query && !parsed.category && !parsed.flavor && tags.length === 0) {
        score += 1;
      }

      if (parsed.category && product.category === parsed.category) {
        score += 3;
        reasons.push(`分类匹配：${product.categoryName}`);
      }

      if (parsed.flavor && product.flavors.includes(parsed.flavor)) {
        score += 3;
        reasons.push(`口味匹配：${parsed.flavor}`);
      }

      for (const tag of tags) {
        if (product.tags.includes(tag)) {
          score += 2;
          reasons.push(`标签匹配：${tag}`);
        }
      }

      return { product, score, reasons };
    })
    .filter((item): item is { product: Product; score: number; reasons: string[] } => {
      return item !== null && item.product.stock > 0 && item.score > 0;
    })
    .sort((a, b) => b.score - a.score || a.product.salesRank - b.product.salesRank)
    .slice(0, parsed.limit)
    .map((item) => ({
      ...item.product,
      matchScore: item.score,
      matchReasons: item.reasons,
    }));

  return {
    count: results.length,
    products: results,
  };
}

async function queryActivities(input: unknown) {
  const parsed = queryActivitiesInputSchema.parse(input);
  const at = parsed.at ? new Date(parsed.at) : new Date();
  const [products, activities] = await Promise.all([readProducts(), readActivities()]);
  const selectedProducts = products.filter((product) => !parsed.productIds || parsed.productIds.includes(product.id));

  const results = activities
    .filter((activity) => activity.enabled && isWithinValidity(activity, at))
    .map((activity) => ({
      ...activity,
      matchedProductIds: selectedProducts
        .filter((product) => appliesToProduct(activity, product))
        .map((product) => product.id),
    }))
    .filter((activity) => activity.scope === "all" || activity.matchedProductIds.length > 0);

  return {
    count: results.length,
    activities: results,
  };
}

async function queryCoupons(input: unknown) {
  const parsed = queryCouponsInputSchema.parse(input);
  const at = parsed.at ? new Date(parsed.at) : new Date();
  const [products, coupons, users] = await Promise.all([readProducts(), readCoupons(), readUsers()]);
  const user = parsed.userId ? users.find((item) => item.id === parsed.userId) : null;
  const selectedProducts = products.filter((product) => !parsed.productIds || parsed.productIds.includes(product.id));

  const results = coupons
    .filter((coupon) => coupon.enabled && isWithinValidity(coupon, at))
    .filter((coupon) => {
      if (coupon.couponType === "new_customer") {
        return user?.isNewCustomer === true;
      }

      if (parsed.subtotal !== undefined && parsed.subtotal < coupon.minSpend) {
        return false;
      }

      return coupon.scope === "all" || selectedProducts.some((product) => appliesToProduct(coupon, product));
    })
    .map((coupon) => ({
      ...coupon,
      matchedProductIds: selectedProducts
        .filter((product) => appliesToProduct(coupon, product))
        .map((product) => product.id),
    }));

  return {
    count: results.length,
    coupons: results,
  };
}

async function calculatePrice(input: unknown) {
  const parsed = calculatePriceInputSchema.parse(input);
  const at = parsed.at ? new Date(parsed.at) : new Date();
  const [products, activities, coupons, users] = await Promise.all([
    readProducts(),
    readActivities(),
    readCoupons(),
    readUsers(),
  ]);
  const product = products.find((item) => item.id === parsed.productId);
  const user = parsed.userId ? users.find((item) => item.id === parsed.userId) : null;

  if (!product) {
    throw new Error(`Product not found: ${parsed.productId}`);
  }

  const subtotal = roundMoney(product.price * parsed.quantity);
  const applicableActivities = activities.filter(
    (activity) =>
      activity.enabled &&
      isWithinValidity(activity, at) &&
      appliesToProduct(activity, product) &&
      subtotal >= activity.minSpend,
  );
  const bestActivity = pickBestDiscount(applicableActivities);
  const afterActivity = roundMoney(subtotal - (bestActivity?.discountAmount ?? 0));
  const applicableCoupons = coupons.filter(
    (coupon) =>
      coupon.enabled &&
      isWithinValidity(coupon, at) &&
      appliesToProduct(coupon, product) &&
      afterActivity >= coupon.minSpend &&
      (coupon.couponType !== "new_customer" || user?.isNewCustomer === true) &&
      (!parsed.couponId || coupon.id === parsed.couponId),
  );
  const bestCoupon = pickBestDiscount(applicableCoupons);
  const finalPrice = roundMoney(afterActivity - (bestCoupon?.discountAmount ?? 0));

  return {
    productId: product.id,
    productName: product.name,
    userId: parsed.userId ?? null,
    newCustomerCouponEligible: user?.isNewCustomer === true,
    unitPrice: product.price,
    quantity: parsed.quantity,
    subtotal,
    activity: bestActivity
      ? {
          id: bestActivity.id,
          name: bestActivity.name,
          discountAmount: bestActivity.discountAmount,
        }
      : null,
    coupon: bestCoupon
      ? {
          id: bestCoupon.id,
          name: bestCoupon.name,
          discountAmount: bestCoupon.discountAmount,
        }
      : null,
    finalPrice,
    savedAmount: roundMoney(subtotal - finalPrice),
    ruleOrder: "商品小计 -> 活动满减 -> 优惠券 -> 最终价",
  };
}

async function queryOrders(input: unknown) {
  const parsed = queryOrdersInputSchema.parse(input);
  const orders = await readOrders();
  const results = orders.filter((order) => {
    if (parsed.orderId && order.id !== parsed.orderId) {
      return false;
    }
    if (parsed.orderNo && order.orderNo !== parsed.orderNo) {
      return false;
    }
    if (parsed.userId && order.userId !== parsed.userId) {
      return false;
    }
    return parsed.orderId || parsed.orderNo || parsed.userId;
  });

  return {
    count: results.length,
    orders: results,
  };
}

async function queryLogistics(input: unknown) {
  const parsed = queryLogisticsInputSchema.parse(input);
  const [orders, logisticsRules] = await Promise.all([
    readOrders(),
    readJsonFile<Array<Record<string, unknown>>>("logistics.json", []),
  ]);
  const order = orders.find(
    (item) =>
      (parsed.orderId && item.id === parsed.orderId) ||
      (parsed.orderNo && item.orderNo === parsed.orderNo),
  );
  const region = parsed.region || order?.shippingRegion;
  const regionRule = logisticsRules.find((rule) => rule.region === region) ?? null;

  return {
    order: order
      ? {
          id: order.id,
          orderNo: order.orderNo,
          carrier: order.carrier,
          trackingNo: order.trackingNo,
          logisticsStatus: order.logisticsStatus,
          shippingRegion: order.shippingRegion,
        }
      : null,
    regionRule,
  };
}

async function readProducts() {
  const products = await readJsonFile<unknown[]>("products.json", []);
  return products.map((product) => productSchema.parse(product));
}

async function readActivities() {
  const activities = await readJsonFile<unknown[]>("activities.json", []);
  return activities.map((activity) => promotionSchema.parse(activity));
}

async function readCoupons() {
  const coupons = await readJsonFile<unknown[]>("coupons.json", []);
  return coupons.map((coupon) => couponSchema.parse(coupon));
}

async function readOrders() {
  const orders = await readJsonFile<unknown[]>("orders.json", []);
  return orders.map((order) => orderSchema.parse(order));
}

async function readUsers() {
  const users = await readJsonFile<unknown[]>("users.json", []);
  return users.map((user) => userSchema.parse(user));
}

function appliesToProduct(rule: Promotion | Coupon, product: Product) {
  if (rule.scope === "all") {
    return true;
  }

  if (rule.scope === "category") {
    return rule.categories?.includes(product.category) ?? false;
  }

  if (rule.scope === "product") {
    return rule.productIds?.includes(product.id) ?? false;
  }

  if (rule.scope === "tag") {
    return rule.tags?.some((tag) => product.tags.includes(tag)) ?? false;
  }

  return false;
}

function isWithinValidity(rule: Promotion | Coupon, at: Date) {
  const from = rule.validFrom ? new Date(rule.validFrom) : null;
  const until = rule.validUntil ? new Date(rule.validUntil) : null;
  return (!from || at >= from) && (!until || at <= until);
}

function pickBestDiscount<T extends Promotion | Coupon>(items: T[]) {
  return [...items].sort((a, b) => b.discountAmount - a.discountAmount)[0] ?? null;
}

function roundMoney(value: number) {
  return Math.max(0, Math.round(value * 100) / 100);
}

function createToolError(toolId: string, input: unknown, error: string, durationMs = 0): ToolRunResult {
  return {
    ok: false,
    toolId,
    input,
    error,
    durationMs,
    executedAt: new Date().toISOString(),
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
