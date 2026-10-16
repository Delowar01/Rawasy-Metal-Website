/**
 * The JSON body of an admin upload request (framework-free, unit-tested), read as a stream with a byte cap: a body with
 * no `Content-Length` (chunked) is never buffered past `max` bytes — the read stops and the stream is cancelled there.
 * Null when it is longer than `max`, not UTF-8 or not JSON; `{}` for an empty body.
 */
export async function readJsonBody(request: Request, max = 4096): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^[0-9]{1,15}$/.test(declared.trim()) || Number(declared) > max)) return null;
  if (!request.body) return {};
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
    return text.trim() ? JSON.parse(text) : {};
  } catch {
    return null;
  }
}
