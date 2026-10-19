/**
 * Shares only currently pending reads. Nothing is cached after completion.
 * A write starts a new generation so a subsequent read never joins a pre-write request.
 */
export function createRequestCoordinator() {
  let generation = 0;
  const pending = new Map<string, Promise<unknown>>();
  return {
    invalidate() {
      generation += 1;
      pending.clear();
    },
    read<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
      const scoped = `${generation}:${key}`;
      const existing = pending.get(scoped);
      if (existing) return existing as Promise<T>;
      const request = Promise.resolve().then(fetcher);
      pending.set(scoped, request);
      void request.finally(() => {
        if (pending.get(scoped) === request) pending.delete(scoped);
      }).catch(() => undefined);
      return request;
    },
  };
}
