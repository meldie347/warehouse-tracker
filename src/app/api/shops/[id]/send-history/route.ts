import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedRequest } from "@/lib/apiHelpers";
import { getSendSummary, groupByCategory } from "@/lib/data";
import { formatDateInputValue, parseShopLocalDateInput, shopLocalStartOfNextDay } from "@/lib/dateFormat";

/** Today's SEND activity for one shop, for the Send page's "Recent sends today" section. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedRequest(request);
  if ("error" in auth) return auth.error;

  const { id: shopId } = await params;

  const since = parseShopLocalDateInput(formatDateInputValue(new Date()))!;
  const until = shopLocalStartOfNextDay(since);

  const [summary] = await getSendSummary(since, until, shopId);
  if (!summary) {
    return NextResponse.json({ shopName: null, categories: [] });
  }

  return NextResponse.json({ shopName: summary.shopName, categories: groupByCategory(summary.rows) });
}
