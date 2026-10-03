import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import type { MarketplaceParser, Transaction } from "../../core/types.js";

type Row = Record<string, string | number>;

const COL = {
  order: "หมายเลขคำสั่งซื้อ",
  orderDate: "วันที่ทำการสั่งซื้อ",
  status: "สถานะการสั่งซื้อ",
  qty: "จำนวน",
  returnedQty: "จำนวนที่ส่งคืน",
  netPrice: "ราคาขายสุทธิ", // line total after seller discounts; Shopee-funded vouchers/coins are not deducted
  sellerCode: "โค้ดส่วนลดชำระโดยผู้ขาย",
  sellerBundle: "ส่วนลด bundle deal ชำระโดยผู้ขาย",
  commission: "ค่าคอมมิชชั่น",
  transactionFee: "Transaction Fee",
  serviceFee: "ค่าบริการ",
  shippingPaidByBuyer: "ค่าจัดส่งที่ชำระโดยผู้ซื้อ",
  shippingSubsidy: "ค่าจัดส่งที่ Shopee ออกให้โดยประมาณ",
  shippingEstimate: "ค่าจัดส่งโดยประมาณ",
  returnShipping: "ค่าจัดส่งสินค้าคืน",
} as const;

const VAT_RATE = 0.07;
const COMPLETED = "สำเร็จแล้ว";
const num = (r: Row, k: string) => parseFloat(String(r[k])) || 0;

/**
 * Parses the Shopee "Order.completed" xlsx export (Seller Centre > My Sales > Completed).
 *
 * Income follows the "ภาษีต้องรู้" Shopee method (YouTube BC1HNdvJhX8), per completed order:
 *   Revenue = ราคาขายสุทธิ - ส่วนลดโค้ดผู้ขาย - ส่วนลด bundle deal ผู้ขาย + ค่าจัดส่งที่ผู้ซื้อชำระ
 * Shopee-funded vouchers/coins are NOT deducted. Returned quantities are deducted too (not shown
 * in the video, but refunded money is not income).
 *
 * The file is order-level: seller-discount, fee and shipping columns repeat on every line of a
 * multi-item order, so they are emitted once per order. Shopee fees are assumed VAT-inclusive.
 */
export class ShopeeParser implements MarketplaceParser {
  readonly name = "shopee";
  readonly extensions = [".xlsx"];

  parse(filePath: string): Transaction[] {
    const wb = XLSX.read(readFileSync(filePath));
    const rows = XLSX.utils.sheet_to_json<Row>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
    const out: Transaction[] = [];
    const seenOrders = new Set<string>();

    for (const r of rows) {
      const orderId = String(r[COL.order]);
      if (!orderId || String(r[COL.status]) !== COMPLETED) continue;
      const date = String(r[COL.orderDate]).slice(0, 10);
      const base = { date, orderId, vat: 0 };

      // Line-level: sales and returns
      const net = num(r, COL.netPrice);
      out.push({ ...base, type: "ราคาขายสินค้า", category: "sale", amount: net });
      const returned = num(r, COL.returnedQty);
      if (returned > 0) {
        const unit = net / (num(r, COL.qty) || 1);
        out.push({ ...base, type: "สินค้าที่ถูกคืน", category: "sale_return", amount: -unit * returned });
      }

      // Order-level: emit once
      if (seenOrders.has(orderId)) continue;
      seenOrders.add(orderId);

      // Seller-funded discounts reduce revenue; buyer-paid shipping is part of revenue.
      const sale = (type: string, amount: number): void => {
        if (amount) out.push({ ...base, type, category: "sale", amount });
      };
      sale("ส่วนลดโค้ดผู้ขาย", -num(r, COL.sellerCode));
      sale("ส่วนลด bundle deal ผู้ขาย", -num(r, COL.sellerBundle));
      sale("ค่าจัดส่งที่ผู้ซื้อชำระ", num(r, COL.shippingPaidByBuyer));

      const fee = (type: string, value: number): void => {
        if (value) out.push({ ...base, type, category: "expense", amount: -value, vat: (value * VAT_RATE) / (1 + VAT_RATE) });
      };
      fee("ค่าคอมมิชชั่น", num(r, COL.commission));
      fee("Transaction Fee", num(r, COL.transactionFee));
      fee("ค่าบริการ", num(r, COL.serviceFee));

      // Actual shipping borne by the seller: carrier estimate less Shopee subsidy
      const shippingCost = num(r, COL.shippingEstimate) - num(r, COL.shippingSubsidy);
      if (shippingCost) out.push({ ...base, type: "ค่าจัดส่งจริงที่ร้านรับภาระ", category: "expense", amount: -shippingCost });
      const returnShipping = num(r, COL.returnShipping);
      if (returnShipping) out.push({ ...base, type: "ค่าจัดส่งสินค้าคืน", category: "expense", amount: -returnShipping });
    }
    return out;
  }
}
