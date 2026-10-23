import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { URL } from "node:url";
import test from "node:test";

const source = readFileSync(new URL("../../public/app-viewport.js", import.meta.url), "utf8");

function install({ innerHeight = 768, clientHeight = 768, visualHeight = 768, scale = 1, visual = true } = {}) {
  const properties = new Map<string, string>();
  const events = new Map<string, () => void>();
  const style = { getPropertyValue: (key: string) => properties.get(key), setProperty: (key: string, value: string) => properties.set(key, value) };
  const window = {
    innerHeight, outerHeight: 900, visualViewport: visual ? { height: visualHeight, scale, addEventListener: () => {} } : undefined,
    addEventListener: (name: string, callback: () => void) => events.set(name, callback),
    requestAnimationFrame: (callback: () => void) => callback(),
  };
  const document = { documentElement: { clientHeight, style }, addEventListener: () => {} };
  runInNewContext(source, { window, document, Math, Boolean });
  return { window, document, events, height: () => properties.get("--app-viewport-height") };
}

test("web content uses inner/client height, never the native outer height", () => {
  assert.equal(install().height(), "768px");
  assert.equal(install({ clientHeight: 738 }).height(), "738px");
  assert.equal(install({ innerHeight: 738 }).height(), "738px");
  assert.equal(install({ clientHeight: 0, visual: false }).height(), "768px");
});

test("reduced visual viewport is respected without treating pinch zoom as a window resize", () => {
  assert.equal(install({ visualHeight: 500 }).height(), "500px");
  assert.equal(install({ visualHeight: 384, scale: 2 }).height(), "768px");
});

test("resize updates the measured root height after shrinking and restoring", () => {
  const fixture = install({ visual: false });
  fixture.window.innerHeight = 600;
  fixture.events.get("resize")!();
  assert.equal(fixture.height(), "600px");
  fixture.window.innerHeight = 768;
  fixture.events.get("resize")!();
  assert.equal(fixture.height(), "768px");
});
