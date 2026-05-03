// Build a fully-qualified URL for downloading PDFs from the API server.
// We rely on the same conventions as the generated client's customFetch:
// the API base path is /api, mounted under the artifact base path.
//
// Browser navigation (e.g. window.open / <a href>) does NOT carry our custom
// `x-samax-tenant` header, so we propagate the tenant via a query param. The
// API's resolveTenant middleware accepts `?tenant=` as a fallback.
export function customFetchUrl(path: string, tenantId?: string): string {
  let url: string;
  if (path.startsWith("http")) url = path;
  else if (path.startsWith("/api/")) url = path;
  else if (path.startsWith("/")) url = `/api${path}`;
  else url = `/api/${path}`;
  if (tenantId) {
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}tenant=${encodeURIComponent(tenantId)}`;
  }
  return url;
}
