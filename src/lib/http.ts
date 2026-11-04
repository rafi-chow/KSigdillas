export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
// Bound bytes while streaming, including requests without Content-Length.
export async function boundedText(request: Request, maximum: number) {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > maximum))
    throw new RequestError("Request too large.", 413);
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0,
    text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximum) {
        await reader.cancel();
        throw new RequestError("Request too large.", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
export async function boundedJson(
  request: Request,
  maximum = 40000,
): Promise<unknown> {
  try {
    return JSON.parse(await boundedText(request, maximum));
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError("Invalid JSON request.", 400);
  }
}
