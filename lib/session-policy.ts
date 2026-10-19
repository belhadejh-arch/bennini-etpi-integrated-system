/** Only an explicit authentication rejection can invalidate a saved session. */
export function shouldClearSavedSession(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  return status === 401 || status === 403;
}
