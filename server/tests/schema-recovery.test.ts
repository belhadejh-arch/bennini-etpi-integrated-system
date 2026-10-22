import { strict as assert } from "node:assert";
import { test } from "node:test";
import { isMissingSchemaObject, withSchemaRecovery } from "../schema-recovery";

test("purchase schema recovery retries only missing-schema PostgreSQL errors once", async () => {
  for (const code of ["3F000", "42P01", "42703"]) {
    let attempts = 0;
    let repairs = 0;
    const result = await withSchemaRecovery(async () => {
      attempts += 1;
      if (attempts === 1) throw Object.assign(new Error("schema mismatch"), { code });
      return "saved";
    }, async () => { repairs += 1; });
    assert.equal(result, "saved");
    assert.equal(attempts, 2);
    assert.equal(repairs, 1);
    assert.equal(isMissingSchemaObject(Object.assign(new Error("schema mismatch"), { code })), true);
  }
});

test("purchase schema recovery never replays unrelated failures or retries twice", async () => {
  let attempts = 0;
  let repairs = 0;
  const constraintError = Object.assign(new Error("constraint violation"), { code: "23503" });
  await assert.rejects(withSchemaRecovery(async () => {
    attempts += 1;
    throw constraintError;
  }, async () => { repairs += 1; }), (error) => error === constraintError);
  assert.equal(attempts, 1);
  assert.equal(repairs, 0);

  attempts = 0;
  const secondError = Object.assign(new Error("still missing"), { code: "42P01" });
  await assert.rejects(withSchemaRecovery(async () => {
    attempts += 1;
    throw secondError;
  }, async () => { repairs += 1; }), (error) => error === secondError);
  assert.equal(attempts, 2);
  assert.equal(repairs, 1);
});
