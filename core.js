export const emptyState = () => ({ stations: [], models: [], usages: [], priceHistory: [], settings: { theme: "light" } });
export const priceKeys = ["input", "output", "cacheRead", "cacheWrite"];
export const priceLabels = { input: "输入", output: "输出", cacheRead: "缓存读取", cacheWrite: "缓存写入" };
export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
export const now = () => new Date().toISOString();

export function estimate(prices, counts = {}) {
  const missing = priceKeys.filter(key => Number(counts[key] || 0) > 0 && (prices?.[key] === null || prices?.[key] === undefined || prices?.[key] === "" || !Number.isFinite(Number(prices[key]))));
  if (missing.length) return { ok: false, missing, currency: prices?.currency || "USD" };
  const multiplier = prices?.multiplier === "" || prices?.multiplier == null ? 1 : Number(prices.multiplier);
  if (!Number.isFinite(multiplier) || multiplier <= 0) return { ok: false, missing: ["倍率无效"], currency: prices?.currency || "USD" };
  const items = Object.fromEntries(priceKeys.map(key => [key, Number(counts[key] || 0) / 1_000_000 * Number(prices?.[key] ?? 0) * multiplier]));
  return { ok: true, items, total: Object.values(items).reduce((sum, n) => sum + n, 0), currency: prices?.currency || "USD", multiplier };
}

export function sortQuotes(models, metric = "input", direction = "asc") {
  const groups = new Map();
  for (const model of models) {
    const currency = model.prices?.currency || "USD";
    if (!groups.has(currency)) groups.set(currency, []);
    groups.get(currency).push(model);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([currency, list]) => [
    { currency, header: true },
    ...list.sort((a, b) => {
      const av = a.prices?.[metric], bv = b.prices?.[metric];
      const ak = av !== null && av !== undefined && av !== "" && Number.isFinite(Number(av));
      const bk = bv !== null && bv !== undefined && bv !== "" && Number.isFinite(Number(bv));
      if (ak !== bk) return ak ? -1 : 1;
      if (!ak) return a.name.localeCompare(b.name);
      return (Number(av) - Number(bv)) * (direction === "asc" ? 1 : -1);
    })
  ]);
}

export function validateBackup(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.stations) || !Array.isArray(value.models) || !Array.isArray(value.usages) || !Array.isArray(value.priceHistory)) throw new Error("备份结构不完整");
  if (value.stations.some(x => !x || typeof x.id !== "string" || typeof x.name !== "string")) throw new Error("中转站数据格式错误");
  if (value.models.some(x => !x || typeof x.id !== "string" || typeof x.name !== "string" || !x.prices || typeof x.prices !== "object")) throw new Error("模型数据格式错误");
  if (value.usages.some(x => !x || typeof x.id !== "string")) throw new Error("使用记录格式错误");
  return { ...emptyState(), ...value, settings: { theme: "light", ...(value.settings || {}) } };
}

export function restoreState(current, imported, mode = "merge") {
  const incoming = validateBackup(imported);
  if (mode === "replace") return structuredClone(incoming);
  const result = structuredClone(validateBackup(current));
  for (const key of ["stations", "models", "usages", "priceHistory"]) {
    const map = new Map(result[key].map(item => [item.id, item]));
    for (const item of incoming[key]) map.set(item.id, structuredClone(item));
    result[key] = [...map.values()];
  }
  result.settings = { ...result.settings, ...incoming.settings };
  return result;
}

export function csv(rows) {
  return rows.map(row => row.map(value => {
    const text = value == null ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }).join(",")).join("\r\n");
}
