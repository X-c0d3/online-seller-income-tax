import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import type { Category, MarketplaceParser, Transaction } from "../../core/types.js";

const COL = {
  type: "ชื่อรายการธุรกรรม",
  amount: "จำนวนเงิน(รวมภาษี)",
  vat: "VAT Amount",
  order: "หมายเลขคำสั่งซื้อ",
  period: "ระยะเวลาใบแจ้งยอด",
} as const;

const SALE = ["ยอดรวมค่าสินค้า"];
const SALE_RETURN = ["หักเงินค่าสินค้า (คืนสินค้า)"];
// fees, promo, return shipping; also matches "คืนส่วนลดค่าธรรมเนียม*" (fee refund, positive amount)
const EXPENSE_PATTERNS = ["ค่าธรรมเนียม", "ค่าบริการ", "ค่าขนส่ง"];

function categorize(type: string): Category {
  if (SALE.includes(type)) return "sale";
  if (SALE_RETURN.includes(type)) return "sale_return";
  if (EXPENSE_PATTERNS.some((p) => type.includes(p))) return "expense";
  return "other";
}

/** Parses the Lazada "Income Overview" xlsx export (Seller Center > Finance). */
export class LazadaParser implements MarketplaceParser {
  readonly name = "lazada";
  readonly extensions = [".xlsx"];

  parse(filePath: string): Transaction[] {
    const wb = XLSX.read(readFileSync(filePath));
    const ws = wb.Sheets[wb.SheetNames[0]];
    // The export's <dimension> is wrongly A1:A<n>, which hides every other column.
    ws["!ref"] = "A1:Z100000";
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws, { defval: "" });

    return rows
      .filter((r) => r[COL.type])
      .map((r) => {
        const type = String(r[COL.type]);
        return {
          date: String(r[COL.period]).split(" - ")[0],
          orderId: String(r[COL.order]),
          type,
          category: categorize(type),
          amount: Number(r[COL.amount]) || 0,
          vat: Number(r[COL.vat]) || 0,
        };
      });
  }
}
