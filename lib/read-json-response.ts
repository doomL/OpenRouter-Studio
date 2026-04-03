/**
 * Parse a fetch `Response` as JSON. If the body is HTML (502 pages, login redirects, etc.),
 * throws a readable error instead of `Unexpected token '<'`.
 */
export async function readJsonResponse<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    if (!res.ok) {
      throw new Error(`Request failed (HTTP ${res.status}) with an empty body.`);
    }
    throw new Error("Empty response body.");
  }
  const first = trimmed[0];
  if (first !== "{" && first !== "[") {
    const htmlHint =
      "The server sent a web page instead of JSON — often a reverse-proxy error, wrong app URL, or a login redirect. Check the network tab for the failing request.";
    throw new Error(!res.ok ? `${htmlHint} (HTTP ${res.status})` : htmlHint);
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "parse error";
    throw new Error(`Invalid JSON (HTTP ${res.status}): ${msg}`);
  }
}
