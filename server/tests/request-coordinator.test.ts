import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createRequestCoordinator } from "../../lib/request-coordinator";

test("simultaneous identical reads send one request and never cache completed financial data", async () => {
  const coordinator = createRequestCoordinator();
  let calls = 0;
  const fetcher = async () => ({ balance: ++calls });
  const [a, b] = await Promise.all([coordinator.read("account:a:ledger", fetcher), coordinator.read("account:a:ledger", fetcher)]);
  assert.equal(calls, 1);
  assert.deepEqual(a, b);
  assert.equal((await coordinator.read("account:a:ledger", fetcher)).balance, 2);
});

test("different accounts, languages and filters never share a pending result", async () => {
  const coordinator = createRequestCoordinator();
  let calls = 0;
  await Promise.all(["a:ar:all", "b:ar:all", "a:fr:all", "a:ar:pending"].map((key) =>
    coordinator.read(key, async () => ++calls)));
  assert.equal(calls, 4);
});

test("writes invalidate pending reads without letting an older completion erase the new request", async () => {
  const coordinator = createRequestCoordinator();
  let resolveOld!: (value: number) => void;
  let resolveNew!: (value: number) => void;
  const old = coordinator.read("ledger", () => new Promise<number>((resolve) => { resolveOld = resolve; }));
  await Promise.resolve();
  coordinator.invalidate();
  const fresh = coordinator.read("ledger", () => new Promise<number>((resolve) => { resolveNew = resolve; }));
  await Promise.resolve();
  resolveOld(10);
  await old;
  const duplicate = coordinator.read("ledger", async () => 999);
  resolveNew(20);
  assert.equal(await fresh, 20);
  assert.equal(await duplicate, 20);
});

test("a failed request is shared only while pending and the next attempt retries", async () => {
  const coordinator = createRequestCoordinator();
  let calls = 0;
  const fail = async () => { calls += 1; throw new Error("offline"); };
  const results = await Promise.allSettled([coordinator.read("ledger", fail), coordinator.read("ledger", fail)]);
  assert.equal(calls, 1);
  assert.ok(results.every((result) => result.status === "rejected"));
  assert.equal(await coordinator.read("ledger", async () => 42), 42);
});
