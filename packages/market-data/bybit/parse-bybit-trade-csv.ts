export type BybitTradeRow = {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  price: number;
  size: number;
  time: number;
};

type ColumnMap = {
  id: number | null;
  symbol: number | null;
  side: number;
  price: number;
  size: number;
  time: number;
};

const COLUMN_ALIASES = {
  id: ["id", "tradeid", "trade_id", "tradematchid", "trdmatchid", "execid"],
  symbol: ["symbol", "coin", "s"],
  side: ["side", "buyerisseller", "isbuyermaker", "is_buyer_maker"],
  price: ["price", "p", "px"],
  size: ["size", "qty", "quantity", "q", "v"],
  time: ["time", "timestamp", "t", "ts", "exec_time"],
};

export function parseBybitTradeCsv(input: {
  text: string;
  symbol: string;
}): BybitTradeRow[] {
  const lines = input.text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const header = splitCsvLine(lines[0]).map(normalizeColumnName);
  const columns = columnsFor(header);
  const rows: BybitTradeRow[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const values = splitCsvLine(lines[lineIndex]);
    if (values.length < header.length) continue;
    const row = rowFor({ values, columns, fallbackSymbol: input.symbol, lineNumber: lineIndex + 1 });
    if (row) rows.push(row);
  }

  return rows.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
}

function columnsFor(header: string[]): ColumnMap {
  const columns: ColumnMap = {
    id: firstColumn(header, COLUMN_ALIASES.id),
    symbol: firstColumn(header, COLUMN_ALIASES.symbol),
    side: requiredColumn(header, COLUMN_ALIASES.side, "side"),
    price: requiredColumn(header, COLUMN_ALIASES.price, "price"),
    size: requiredColumn(header, COLUMN_ALIASES.size, "size"),
    time: requiredColumn(header, COLUMN_ALIASES.time, "time"),
  };
  return columns;
}

function rowFor(input: {
  values: string[];
  columns: ColumnMap;
  fallbackSymbol: string;
  lineNumber: number;
}): BybitTradeRow | null {
  const price = parseNumber(input.values[input.columns.price]);
  const size = parseNumber(input.values[input.columns.size]);
  const time = parseTime(input.values[input.columns.time]);
  if (price === null || size === null || time === null) {
    throw new Error(`invalid Bybit trade CSV row at line ${input.lineNumber}`);
  }
  const side = sideFor(input.values[input.columns.side]);
  const symbol = input.columns.symbol === null ? input.fallbackSymbol : input.values[input.columns.symbol].trim().toUpperCase();
  const idValue = input.columns.id === null ? `${time}:${symbol}:${input.lineNumber}` : input.values[input.columns.id].trim();
  return {
    id: idValue.length === 0 ? `${time}:${symbol}:${input.lineNumber}` : idValue,
    symbol,
    side,
    price,
    size,
    time,
  };
}

function sideFor(value: string): "buy" | "sell" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "buy" || normalized === "b" || normalized === "false" || normalized === "0") return "buy";
  if (normalized === "sell" || normalized === "s" || normalized === "true" || normalized === "1") return "sell";
  throw new Error(`unknown Bybit trade side: ${value}`);
}

function parseTime(value: string): number | null {
  const trimmed = value.trim();
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) {
    if (numeric > 1_000_000_000_000_000) return Math.floor(numeric / 1000);
    if (numeric > 1_000_000_000_000) return Math.floor(numeric);
    if (numeric > 1_000_000_000) return Math.floor(numeric * 1000);
  }
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNumber(value: string): number | null {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function requiredColumn(header: string[], aliases: string[], label: string): number {
  const index = firstColumn(header, aliases);
  if (index === null) throw new Error(`Bybit trade CSV is missing required ${label} column`);
  return index;
}

function firstColumn(header: string[], aliases: string[]): number | null {
  for (const alias of aliases) {
    const index = header.indexOf(normalizeColumnName(alias));
    if (index >= 0) return index;
  }
  return null;
}

function normalizeColumnName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      if (quoted && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}


