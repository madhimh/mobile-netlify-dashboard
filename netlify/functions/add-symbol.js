import {
  jsonResponse,
  normalizeSymbolInput,
  fetchPrice,
  fetchYahooCompanyName,
  makeShortArabicName,
  loadCustomSymbols,
  saveCustomSymbols
} from "./_shared.js";

export default async (request) => {
  try {
    const body = await request.json();
    const symbolInput = body?.symbol || "";

    const { normalized, defaultName } = normalizeSymbolInput(symbolInput);

    const testData = await fetchPrice(normalized);
    if (!testData) {
      throw new Error("تعذر جلب بيانات الرمز، تأكد أنه صحيح");
    }

    let shortName = defaultName;
    if (!["^TASI.SR", "^TASI", "TASI", "TASI.SR"].includes(normalized.toUpperCase())) {
      const yahooName = await fetchYahooCompanyName(normalized);
      shortName = makeShortArabicName(normalized, yahooName);
    }

    const custom = await loadCustomSymbols();
    if (["^TASI.SR", "^TASI", "TASI", "TASI.SR"].includes(normalized.toUpperCase())) {
      custom["^TASI"] = "تاسي";
    } else {
      custom[normalized] = shortName;
    }

    await saveCustomSymbols(custom);

    return jsonResponse({
      ok: true,
      symbol: normalized,
      name: shortName
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: String(error.message || error)
    }, 400);
  }
};