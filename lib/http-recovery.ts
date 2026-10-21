export class NetworkRequestError extends Error {
  constructor(public readonly timedOut: boolean, public readonly isWrite: boolean) {
    super(isWrite
      ? "تعذر تأكيد نتيجة العملية. تحقق من السجل قبل إعادة الإرسال."
      : "تعذر الاتصال بالخادم. يرجى إعادة المحاولة.");
    this.name = "NetworkRequestError";
  }
}

export function requestTimeoutMs(url:string){
  return /\/api\/print-document\/[^/?]+(?:\?|$)/.test(url)?120_000:25_000;
}

/** Retry reads only. Retrying a write after a timeout can duplicate a payment. */
export async function fetchWithRecovery(
  url: string,
  options: RequestInit,
  dependencies: {
    fetcher?: typeof fetch;
    sleep?: (milliseconds: number) => Promise<void>;
    timeoutMs?: number;
  } = {},
): Promise<Response> {
  const fetcher = dependencies.fetcher ?? fetch;
  const sleep = dependencies.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const isRead = ["GET", "HEAD"].includes((options.method ?? "GET").toUpperCase());
  const attempts = isRead ? 3 : 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (options.signal?.aborted) throw options.signal.reason ?? new Error("Aborted");
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", abort, { once: true });
    // Rendering a queued PDF is deliberately slower than an ordinary JSON read.
    // Do not abort a valid document while Chromium is still preparing it.
    const timer = setTimeout(() => { timedOut = true; controller.abort(); },
      dependencies.timeoutMs ?? requestTimeoutMs(url));
    let retry = false;
    try {
      const response = await fetcher(url, { ...options, signal: controller.signal });
      retry = isRead && [408, 425, 429, 500, 502, 503, 504].includes(response.status) && attempt < attempts - 1;
      if (!retry) return response;
      try { await response.body?.cancel(); } catch { /* The retry does not depend on draining an error response. */ }
    } catch {
      if (options.signal?.aborted) throw options.signal.reason ?? new Error("Aborted");
      if (attempt === attempts - 1) throw new NetworkRequestError(timedOut, !isRead);
      retry = true;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    }
    if (retry) await sleep(500 * (attempt + 1));
  }
  throw new NetworkRequestError(false, !isRead);
}
