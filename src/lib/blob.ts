/**
 * Vercel Blob helper for storing generated demo + proposal HTML.
 *
 * Gracefully falls back to "no blob" if BLOB_READ_WRITE_TOKEN is missing —
 * callers should still persist the HTML to the DB text column as a fallback.
 */

const BLOB_API = "https://blob.vercel-storage.com";

interface UploadResult {
  ok: boolean;
  url?: string;
  pathname?: string;
  error?: string;
}

export async function uploadHtml(pathname: string, html: string): Promise<UploadResult> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return { ok: false, error: "BLOB_READ_WRITE_TOKEN not set" };
  }

  try {
    const resp = await fetch(`${BLOB_API}/${encodeURIComponent(pathname)}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-content-type": "text/html; charset=utf-8",
        "x-add-random-suffix": "1",
      },
      body: html,
    });
    if (!resp.ok) {
      return { ok: false, error: `HTTP ${resp.status}: ${await resp.text().catch(() => "")}` };
    }
    const json = (await resp.json()) as { url: string; pathname: string };
    return { ok: true, url: json.url, pathname: json.pathname };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

export async function deleteBlob(urlOrPathname: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return { ok: false, error: "BLOB_READ_WRITE_TOKEN not set" };
  try {
    const resp = await fetch(`${BLOB_API}/delete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ urls: [urlOrPathname] }),
    });
    return resp.ok ? { ok: true } : { ok: false, error: `HTTP ${resp.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

export function blobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}
