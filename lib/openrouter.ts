const OPENROUTER_BASE = "https://openrouter.ai/api";

export async function fetchFromOpenRouter(
  path: string,
  apiKey: string,
  options?: RequestInit
) {
  const url = `${OPENROUTER_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://openrouter-studio.local",
      "X-Title": "OpenRouter Studio",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`OpenRouter API error (${res.status}): ${error}`);
  }

  return res;
}
