/** How a transaction is treated in the tax calculation. */
export type Category = "sale" | "sale_return" | "expense" | "other";

/** Marketplace-agnostic transaction. Every marketplace parser must produce these. */
export interface Transaction {
  /** Statement date as shown in the source file (display only). */
  date: string;
  orderId: string;
  /** Original transaction label from the marketplace, e.g. "ยอดรวมค่าสินค้า". */
  type: string;
  category: Category;
  /** Signed amount incl. VAT: income positive, deductions negative. */
  amount: number;
  /** VAT Amount column as reported by the marketplace (unsigned). */
  vat: number;
}

/** Implement this to add a marketplace (e.g. Shopee). */
export interface MarketplaceParser {
  readonly name: string;
  /** File extensions this parser accepts, e.g. [".xlsx"]. */
  readonly extensions: string[];
  parse(filePath: string): Transaction[];
}

export interface TypeRow {
  type: string;
  count: number;
  amount: number;
  vat: number;
}

export interface CashBasisSummary {
  sales: number;
  returns: number;
  /** sales + returns: the figure to file (individual, not VAT-registered). */
  income: number;
  expenses: number;
  /** Actual money received from the marketplace. */
  netReceived: number;
}

export interface AccrualBasisSummary {
  salesInclVat: number;
  returnsInclVat: number;
  netInclVat: number;
  outputVat: number;
  expensesExVat: number;
  inputVat: number;
  /** Pre-VAT income: the figure to file (VAT-registered / accrual basis). */
  incomeExVat: number;
}

export interface TaxSummary {
  transactionCount: number;
  orderCount: number;
  firstDate: string;
  lastDate: string;
  byType: TypeRow[];
  /** Same as Lazada's "ยอดรวมรายรับทั้งหมด": sum of all positive transaction types. */
  totalCredits: { count: number; amount: number };
  cashBasis: CashBasisSummary;
  accrualBasis: AccrualBasisSummary;
}
