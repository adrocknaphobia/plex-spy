export function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

export function attr<T = any>(node: any, name: string): T | null {
  return node?.[`@_${name}`] ?? null;
}

function asset(baseUrl: string, path: string | null) {
  return path ? baseUrl.replace(/\/+$/, "") + path : null;
}

export function normalize(node: any, baseUrl: string) {
  return {
    id: String(attr(node, "ratingKey")),
    type: attr(node, "type"),           // 👈 REQUIRED for generic feeds
    title: attr(node, "title"),
    year: attr(node, "year"),
    summary: attr(node, "summary"),
    addedAt: attr(node, "addedAt"),     // 👈 REQUIRED for "latest"
    viewCount: attr(node, "viewCount"),
    thumb: asset(baseUrl, attr(node, "thumb")),
    art: asset(baseUrl, attr(node, "art"))
  };
}
