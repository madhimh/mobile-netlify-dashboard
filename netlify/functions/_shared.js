import fs from "node:fs";
import path from "node:path";
import { getStore } from "@netlify/blobs";
import { XMLParser } from "fast-xml-parser";

const REQUEST_TIMEOUT = 20000;
const TIMEZONE = "Asia/Riyadh";

const ARGAAM_FEEDS = [
  ["أرقام - الرئيسية", "https://www.argaam.com/ar/rss/ho-main-news?sectionid=1523"],
  ["أرقام - الشركات", "https://www.argaam.com/ar/rss/companies?sectionid=1543"],
  ["أرقام - نبض السوق", "https://www.argaam.com/ar/rss/ho-market-pulse?sectionid=70"],
  ["أرقام - العالمية", "https://www.argaam.com/ar/rss/internationmarket-mainnewsar?sectionid=1334"],
  ["أرقام - خاص", "https://www.argaam.com/ar/rss/educationalmarket-mainnewsar?sectionid=1408"]
];

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true
});

export function jsonResponse(payload, statusCode = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status: statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate, max-age=0"
    }
  });
}

export function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function nowRiyadhString() {
  const dt = new Date();
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(dt).map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function normalizeSymbolInput(userInput) {
  const raw = clean(userInput).toUpperCase();

  if (!raw) {
    throw new Error("رمز السهم فارغ");
  }

  if (["TASI", "^TASI", "TASI.SR", "^TASI.SR"].includes(raw)) {
    return { normalized: "^TASI.SR", defaultName: "تاسي" };
  }

  if (/^\d{3,5}$/.test(raw)) {
    return { normalized: `${raw}.SR`, defaultName: raw };
  }

  if (/^\d{3,5}\.SR$/.test(raw)) {
    return { normalized: raw, defaultName: raw.split(".")[0] };
  }

  throw new Error("صيغة الرمز غير صحيحة");
}

export function normalizeCustomStorageKey(userInput) {
  const { normalized } = normalizeSymbolInput(userInput);
  if (["^TASI.SR", "^TASI", "TASI", "TASI.SR"].includes(normalized.toUpperCase())) {
    return "^TASI";
  }
  return normalized;
}

export function symbolDisplayCode(symbolCode) {
  const code = clean(symbolCode).toUpperCase();
  if (["^TASI", "^TASI.SR", "TASI", "TASI.SR"].includes(code)) return "TASI";
  if (/^\d{3,5}\.SR$/i.test(code)) return code.split(".")[0];
  return code;
}

export function symbolSortValue(symbolCode) {
  const code = symbolDisplayCode(symbolCode);
  if (code === "TASI") return -1;
  if (/^\d{3,5}$/.test(code)) return Number(code);
  return 999999;
}

export function makeShortArabicName(symbol, yahooName) {
  const code = symbolDisplayCode(symbol);

  const manual = {
    "1120": "مصرف الراجحي",
    "1140": "بنك البلاد",
    "1150": "مصرف الإنماء",
    "1180": "البنك الأهلي السعودي",
    "2010": "سابك",
    "2020": "سابك للمغذيات الزراعية",
    "2222": "أرامكو السعودية",
    "2290": "ينساب",
    "2310": "سبكيم العالمية",
    "7010": "إس تي سي",
    "7020": "اتحاد اتصالات (موبايلي)",
    "7202": "سلوشنز",
    "8010": "التعاونية للتأمين",
    "8230": "الراجحي تكافل",
    "TASI": "تاسي"
  };

  if (manual[code]) return manual[code];

  let name = clean(yahooName);

  const replacements = [
    [/الراجحي\s+للتأمين\s+التعاوني/g, "الراجحي تكافل"],
    [/تكافل\s+الراجحي/g, "الراجحي تكافل"],
    [/مصرف\s+الراجحي/g, "مصرف الراجحي"],
    [/بنك\s+البلاد/g, "بنك البلاد"],
    [/مصرف\s+الإنماء/g, "مصرف الإنماء"],
    [/البنك\s+الأهلي\s+السعودي/g, "البنك الأهلي السعودي"],
    [/سابك\s+للمغذيات\s+الزراعية/g, "سابك للمغذيات الزراعية"],
    [/أرامكو\s+السعودية/g, "أرامكو السعودية"],
    [/سبكيم\s+العالمية/g, "سبكيم العالمية"],
    [/اتحاد\s+اتصالات\s+\(موبايلي\)/g, "اتحاد اتصالات (موبايلي)"],
    [/السعودية\s+للاتصالات/g, "إس تي سي"],
    [/شركة\s+/g, ""],
    [/\s+/g, " "]
  ];

  for (const [pattern, replacement] of replacements) {
    name = name.replace(pattern, replacement).trim();
  }

  return name || code;
}

export function loadBaseSymbols() {
  const filePath = path.join(process.cwd(), "symbols_map.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

export async function loadCustomSymbols() {
  const store = getStore("mobile-dashboard");
  const data = await store.get("custom_symbols", { type: "json" });
  return data && typeof data === "object" ? data : {};
}

export async function saveCustomSymbols(data) {
  const store = getStore("mobile-dashboard");
  await store.setJSON("custom_symbols", data);
}

export async function loadAllSymbols() {
  const base = loadBaseSymbols();
  const custom = await loadCustomSymbols();
  return { ...base, ...custom };
}

export async function fetchPrice(symbol) {
  const sym = encodeURIComponent(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1m&range=1d`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0",
        "accept-language": "ar,en;q=0.8"
      },
      signal: controller.signal
    });

    if (!res.ok) return null;
    const j = await res.json();
    const result = j?.chart?.result?.[0];
    const meta = result?.meta || {};

    const last = meta.regularMarketPrice;
    const prev = meta.previousClose;

    if (last == null || prev == null) return null;

    const price = Number(last);
    const prevClose = Number(prev);
    const change = price - prevClose;
    const changePct = prevClose ? (change / prevClose) * 100 : 0;

    return {
      price: Number(price.toFixed(2)),
      change: Number(change.toFixed(2)),
      changePct: Number(changePct.toFixed(2)),
      prevClose: Number(prevClose.toFixed(2))
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchYahooCompanyName(symbol) {
  const sym = encodeURIComponent(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1m&range=1d`;

  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0",
      "accept-language": "ar,en;q=0.8"
    }
  });

  if (!res.ok) return "";
  const j = await res.json();
  const meta = j?.chart?.result?.[0]?.meta || {};
  return clean(meta.shortName || meta.longName || "");
}

export async function buildPriceRows() {
  const nowStr = nowRiyadhString();
  const symbols = await loadAllSymbols();
  const rows = [];

  for (const [code, name] of Object.entries(symbols)) {
    const codeStr = clean(code);

    let symbol;
    let outCode;
    let outName;

    if (["TASI", "^TASI", "TASI.SR", "^TASI.SR"].includes(codeStr.toUpperCase())) {
      symbol = "^TASI.SR";
      outCode = "TASI";
      outName = clean(name) || "تاسي";
    } else {
      symbol = codeStr;
      outCode = symbolDisplayCode(codeStr);
      outName = clean(name);
    }

    try {
      const data = await fetchPrice(symbol);
      if (data) {
        rows.push({
          symbol: outCode,
          name: outName,
          price: data.price,
          change: data.change,
          changePct: data.changePct,
          prevClose: data.prevClose,
          rawSymbol: symbol,
          fetchTime: nowStr
        });
      }
    } catch {}
  }

  return { rows, nowStr };
}

export function extractTasi(rows) {
  return rows.find((r) => String(r.symbol).toUpperCase() === "TASI") || {
    symbol: "TASI",
    name: "تاسي",
    price: "",
    change: "",
    changePct: "",
    prevClose: "",
    rawSymbol: "^TASI.SR"
  };
}

export function extractStocks(rows) {
  return rows
    .filter((r) => String(r.symbol).toUpperCase() !== "TASI")
    .sort((a, b) => symbolSortValue(a.symbol) - symbolSortValue(b.symbol));
}

export async function fetchArgaam(nowStr) {
  const itemsOut = [];

  for (const [feedName, url] of ARGAAM_FEEDS) {
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0",
          "accept-language": "ar,en;q=0.8"
        }
      });

      if (!res.ok) continue;
      const xml = await res.text();
      const parsed = parser.parse(xml);
      let items = parsed?.rss?.channel?.item || [];
      if (!Array.isArray(items)) items = [items];

      let count = 0;
      for (const item of items) {
        const title = clean(item?.title);
        const link = clean(item?.link);
        const pub = clean(item?.pubDate);

        let pubIso = "";
        try {
          if (pub) {
            pubIso = new Date(pub).toLocaleString("sv-SE", {
              timeZone: TIMEZONE,
              hour12: false
            }).replace(",", "");
          }
        } catch {}

        itemsOut.push({
          fetchTime: nowStr,
          source: feedName,
          title,
          time: pubIso,
          url: link
        });

        count += 1;
        if (count >= 50) break;
      }
    } catch {}
  }

  itemsOut.sort((a, b) => parseDt(b.time) - parseDt(a.time));
  return itemsOut.slice(0, 200);
}

function parseDt(v) {
  const t = Date.parse(v?.replace(" ", "T"));
  return Number.isFinite(t) ? t : 0;
}