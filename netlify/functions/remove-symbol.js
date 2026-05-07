import {
  jsonResponse,
  normalizeCustomStorageKey,
  loadCustomSymbols,
  saveCustomSymbols
} from "./_shared.js";

export default async (request) => {
  try {
    const body = await request.json();
    const symbolInput = body?.symbol || "";
    const storageKey = normalizeCustomStorageKey(symbolInput);

    const custom = await loadCustomSymbols();
    if (!(storageKey in custom)) {
      throw new Error("هذا السهم ليس من الأسهم المضافة يدويًا");
    }

    delete custom[storageKey];
    await saveCustomSymbols(custom);

    return jsonResponse({
      ok: true,
      symbol: storageKey
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: String(error.message || error)
    }, 400);
  }
};