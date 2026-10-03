import { readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { ConsoleReporter, LazadaParser, ShopeeParser, TaxCalculator } from "./index.js";
import type { MarketplaceParser } from "./index.js";

// Register new marketplaces here
const parsers: MarketplaceParser[] = [new LazadaParser(), new ShopeeParser()];

// usage: npm start -- [marketplace] [dir]
const ROOT = "excel"; // excel/<Marketplace>/*.xlsx
const [marketplace = "lazada", dirArg] = process.argv.slice(2);
const parser = parsers.find((p) => p.name === marketplace);
if (!parser) throw new Error(`ไม่รู้จัก marketplace "${marketplace}" (มี: ${parsers.map((p) => p.name).join(", ")})`);

const dir = dirArg ?? join(ROOT, readdirSync(ROOT).find((d) => d.toLowerCase() === parser.name) ?? parser.name);
const files = readdirSync(dir).filter((f) => parser.extensions.includes(extname(f)) && !f.startsWith("~"));
if (!files.length) throw new Error(`ไม่พบไฟล์ใน ${dir}`);

const calculator = new TaxCalculator();
const reporter = new ConsoleReporter();
let cash = 0;
let exVat = 0;
for (const f of files) {
  const summary = calculator.calculate(parser.parse(join(dir, f)));
  reporter.print(f, summary);
  cash += summary.cashBasis.income;
  exVat += summary.accrualBasis.incomeExVat;
}
if (files.length > 1) reporter.printGrandTotal(cash, exVat);
