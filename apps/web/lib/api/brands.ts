import {
  BrandProductsResponseSchema,
  BrandSummarySchema,
  type BrandProductsPageType,
  type BrandSummaryType,
} from "@repo/contracts";
import { safeParseSchema } from "@repo/contracts/common";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3006/api";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function getBrandSummaries(): Promise<BrandSummaryType[]> {
  const data = await fetchJson<unknown>(`${API_BASE_URL}/brands/list`);
  const parsed = BrandSummarySchema.array().safeParse(data);

  if (!parsed.success) {
    throw new Error("Invalid brand summaries response");
  }

  return parsed.data;
}

export async function getBrandProducts(
  brandId: string,
  page = 1,
  limit = 10,
): Promise<BrandProductsPageType> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const data = await fetchJson<unknown>(
    `${API_BASE_URL}/brands/${brandId}/products?${params}`,
  );
  const parsed = safeParseSchema(BrandProductsResponseSchema, data);

  if (!parsed.success) {
    throw new Error("Invalid brand products response");
  }

  return parsed.data;
}
