import {
  jsonResponse,
  buildPriceRows,
  extractTasi,
  extractStocks,
  fetchArgaam
} from "./_shared.js";

export default async () => {
  try {
    const { rows, nowStr } = await buildPriceRows();
    const payload = {
      app_version: "MOBILE_NETLIFY_DASHBOARD_V1",
      tasi: extractTasi(rows),
      prices: extractStocks(rows),
      news: await fetchArgaam(nowStr),
      source: "Yahoo Finance + Argaam RSS",
      status: "live",
      status_text: "متصل مباشر",
      last_update: nowStr
    };

    return jsonResponse(payload, 200);
  } catch (error) {
    return jsonResponse({
      app_version: "MOBILE_NETLIFY_DASHBOARD_V1",
      tasi: {},
      prices: [],
      news: [],
      source: "Yahoo Finance + Argaam RSS",
      status: "error",
      status_text: `تعذر التحديث: ${String(error.message || error).slice(0, 120)}`,
      last_update: ""
    }, 500);
  }
};