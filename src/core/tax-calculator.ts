import type { Transaction, TaxSummary, TypeRow } from "./types.js";

export interface TaxCalculatorOptions {
  /** Defaults to Thai VAT 7%. */
  vatRate?: number;
}

export class TaxCalculator {
  private readonly vatRate: number;

  constructor(options: TaxCalculatorOptions = {}) {
    this.vatRate = options.vatRate ?? 0.07;
  }

  calculate(transactions: Transaction[]): TaxSummary {
    const byType = this.groupByType(transactions);
    const sum = (category: Transaction["category"]) =>
      transactions.filter((t) => t.category === category);
    const total = (rows: Transaction[]) => rows.reduce((n, t) => n + t.amount, 0);

    const sales = total(sum("sale"));
    const returns = total(sum("sale_return"));
    const expenseRows = sum("expense");
    const expenses = total(expenseRows);
    const other = total(sum("other"));

    // Per-type sign so fee refunds (positive amount) reduce input VAT instead of adding to it.
    const inputVat = expenseRows.reduce((n, t) => n - Math.sign(t.amount) * t.vat, 0);

    const netInclVat = sales + returns;
    const outputVat = (netInclVat * this.vatRate) / (1 + this.vatRate);

    const credits = byType.filter((r) => r.amount > 0);

    return {
      transactionCount: transactions.length,
      orderCount: new Set(transactions.map((t) => t.orderId)).size,
      firstDate: transactions.at(0)?.date ?? "",
      lastDate: transactions.at(-1)?.date ?? "",
      byType,
      totalCredits: {
        count: credits.reduce((n, r) => n + r.count, 0),
        amount: credits.reduce((n, r) => n + r.amount, 0),
      },
      cashBasis: {
        sales,
        returns,
        income: sales + returns,
        expenses,
        netReceived: sales + returns + expenses + other,
      },
      accrualBasis: {
        salesInclVat: sales,
        returnsInclVat: returns,
        netInclVat,
        outputVat,
        expensesExVat: expenses + inputVat,
        inputVat,
        incomeExVat: netInclVat - outputVat,
      },
    };
  }

  private groupByType(transactions: Transaction[]): TypeRow[] {
    const map = new Map<string, TypeRow>();
    for (const t of transactions) {
      const row = map.get(t.type) ?? { type: t.type, count: 0, amount: 0, vat: 0 };
      row.count++;
      row.amount += t.amount;
      row.vat += t.vat;
      map.set(t.type, row);
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  }
}
