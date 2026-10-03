import type { TaxSummary } from "./types.js";

const baht = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const highlight = (n: number) => `*** ${baht(n)} ***`;

export class ConsoleReporter {
  print(title: string, s: TaxSummary): void {
    console.log(`\n=== ${title} ===`);
    console.log(
      `รายการธุรกรรม ${s.transactionCount} แถว | ${s.orderCount} คำสั่งซื้อ | ${s.firstDate} ถึง ${s.lastDate}`,
    );

    console.log("\nแยกตามประเภทรายการ:");
    const typeTable: Record<string, { "จำนวนรายการ": number; "จำนวนเงิน (บาท)": string }> = {
      "ยอดรวมรายรับทั้งหมด": {
        "จำนวนรายการ": s.totalCredits.count,
        "จำนวนเงิน (บาท)": baht(s.totalCredits.amount),
      },
    };
    for (const r of s.byType)
      typeTable[r.type] = { "จำนวนรายการ": r.count, "จำนวนเงิน (บาท)": baht(r.amount) };
    console.table(typeTable);

    const c = s.cashBasis;
    console.log("[1] สรุปรายได้เพื่อยื่นภาษี (บุคคลธรรมดา ไม่จด VAT / เกณฑ์เงินสด):");
    console.table({
      "ยอดขายสินค้า (ก่อนหักค่าธรรมเนียม)": { "บาท": baht(c.sales) },
      "หัก สินค้าคืน": { "บาท": baht(c.returns) },
      "ค่าใช้จ่าย (ค่าธรรมเนียม/โปรโมท/ขนส่งคืน)": { "บาท": baht(c.expenses) },
      "ยอดเงินที่ได้รับจริงจากตลาดกลาง": { "บาท": baht(c.netReceived) },
      "*** รายได้สุทธิ (ยอดที่นำไปยื่นภาษี) ***": { "บาท": highlight(c.income) },
    });

    const a = s.accrualBasis;
    console.log("[2] สรุปรายได้เพื่อยื่นภาษี (จด VAT / เกณฑ์สิทธิ):");
    console.table({
      "ยอดขายสินค้า (รวม VAT)": { "บาท": baht(a.salesInclVat) },
      "หัก สินค้าคืน (รวม VAT)": { "บาท": baht(a.returnsInclVat) },
      "ยอดขายสุทธิ (รวม VAT)": { "บาท": baht(a.netInclVat) },
      "หัก ภาษีขาย (VAT 7%)": { "บาท": baht(-a.outputVat) },
      "ค่าใช้จ่าย (ไม่รวม VAT)": { "บาท": baht(a.expensesExVat) },
      "ภาษีซื้อจากค่าธรรมเนียม (VAT)": { "บาท": baht(a.inputVat) },
      "*** รายได้ไม่รวม VAT (ยอดที่นำไปยื่นภาษี) ***": { "บาท": highlight(a.incomeExVat) },
    });
  }

  printGrandTotal(cashIncome: number, incomeExVat: number): void {
    console.log(`\nรวมทุกไฟล์: [1] ${baht(cashIncome)} บาท | [2] ${baht(incomeExVat)} บาท`);
  }
}
