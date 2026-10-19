import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("dependency download URLs remain reachable outside the development environment", () => {
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  for (const [name, item] of Object.entries(lock.packages) as Array<[string, { resolved?: string }]>) {
    if (!item.resolved) continue;
    const host = new URL(item.resolved).hostname;
    assert.ok(!host.endsWith(".internal") && host !== "localhost" && !host.startsWith("127."),
      `${name} contains an environment-local download URL`);
  }
});
