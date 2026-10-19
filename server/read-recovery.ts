const transientCodes = new Set([
  "08000", "08001", "08003", "08006", "57P01", "57P02", "57P03", "53300",
  "ECONNRESET", "ECONNREFUSED", "EPIPE", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN",
]);

/** Use only for independent reads, never inside a transaction or around a write. */
export async function retryDatabaseRead<T>(
  read: () => Promise<T>,
  sleep: (milliseconds: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  try {
    return await read();
  } catch (error) {
    const issue = error as { code?: string; message?: string };
    const recoverable = transientCodes.has(issue.code ?? "") ||
      /connection terminated|timeout exceeded when trying to connect/i.test(issue.message ?? "");
    if (!recoverable) throw error;
    await sleep(250);
    return read();
  }
}
