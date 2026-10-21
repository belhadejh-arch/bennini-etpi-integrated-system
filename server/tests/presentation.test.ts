import { strict as assert } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import { uiFrench } from "../../shared/ui-translations-fr";
import { apiErrorFrench } from "../../shared/api-error-translations";

// Run the real theme implementation with a tiny platform stub, without a native runtime.
function themeFor(platform: "web" | "ios") {
  const source = ts.transpileModule(readFileSync("lib/theme.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exported: Record<string, any> = {};
  vm.runInNewContext(source, { exports: exported,
    require: (id: string) => {
      assert.equal(id, "react-native");
      return { Platform: { OS: platform } };
    }, Intl, Date, console });
  return exported;
}

function localizationForTest() {
  const source = ts.transpileModule(readFileSync("lib/localization.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exported: Record<string, any> = {};
  const require = createRequire(path.resolve("lib/localization.ts"));
  vm.runInNewContext(source, { exports: exported,
    require: (id: string) => id === "./theme" ? themeFor("ios") : require(id), console });
  return exported;
}

function luminance(hex: string) {
  const channels = hex.replace("#", "").match(/../g)!.map((value) => {
    const n = parseInt(value, 16) / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const [high, low] = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
}

test("both palettes meet AA contrast for primary, secondary, placeholder and semantic text", () => {
  const { palettes } = themeFor("ios");
  for (const [mode, p] of Object.entries(palettes) as Array<[string, Record<string, string>]>) {
    for (const [text, background] of [
      ["ink", "surface"], ["muted", "surface"], ["placeholder", "surface"],
      ["ink", "background"], ["muted", "background"], ["placeholder", "background"],
      ["green", "greenSoft"], ["red", "redSoft"], ["amber", "amberSoft"],
      ["onAccent", "yellow"], ["white", "action"],
    ]) {
      assert.ok(contrast(p[text], p[background]) >= 4.5,
        `${mode} ${text}/${background}: ${contrast(p[text], p[background]).toFixed(2)}:1`);
    }
  }
});

test("mounted native style references react to theme and language without remounting forms", () => {
  const theme = themeFor("ios");
  const definitions = theme.makeStylesReactive({
    surface: { backgroundColor: theme.colors.surface, direction: "rtl" },
    text: { color: theme.colors.ink, fontSize: 10, fontWeight: "300", lineHeight: 12, textAlign: "right" },
    muted: { color: theme.colors.muted, fontSize: 12 },
    accent: { color: theme.colors.onAccent },
  });
  assert.equal(definitions.surface.backgroundColor, theme.palettes.light.surface);
  // Slightly smaller Changa labels were explicitly requested; retain a readable floor.
  assert.equal(definitions.text.fontSize, 13);
  assert.ok(definitions.text.lineHeight >= 13 * 1.55);
  assert.equal(definitions.text.fontWeight, "500");
  theme.setActivePalette("dark");
  theme.setActiveLanguage("fr");
  assert.equal(definitions.surface.backgroundColor, theme.palettes.dark.surface);
  assert.equal(definitions.text.color, theme.palettes.dark.ink);
  assert.notEqual(definitions.muted.color, theme.palettes.light.muted);
  assert.ok(contrast(definitions.muted.color, theme.palettes.dark.surface) >= 4.5);
  assert.ok(contrast(definitions.accent.color, theme.palettes.dark.yellow) >= 4.5);
  assert.equal(definitions.surface.direction, "ltr");
  assert.equal(definitions.text.textAlign, "left");
  assert.match(theme.formatDzd(12345), /DA/);
  theme.setActivePalette("light");
  theme.setActiveLanguage("ar");
  assert.equal(definitions.surface.backgroundColor, theme.palettes.light.surface);
  assert.equal(definitions.text.textAlign, "right");
  assert.match(theme.formatDzd(12345), /دج/);
});

test("every fixed Arabic interface literal has an explicit French translation", () => {
  const keys = new Set([...Object.keys(uiFrench), ...Object.keys(apiErrorFrench)]);
  const localeTree = ts.createSourceFile("lib/localization.ts", readFileSync("lib/localization.ts", "utf8"), ts.ScriptTarget.Latest, true);
  const readLocalKeys = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(localeTree) === "fr" &&
        node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
      for (const property of node.initializer.properties) {
        if (ts.isPropertyAssignment(property) && ts.isStringLiteral(property.name)) keys.add(property.name.text);
      }
    }
    ts.forEachChild(node, readLocalKeys);
  };
  readLocalKeys(localeTree);
  const appFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => entry.isDirectory() ? appFiles(path.join(directory, entry.name))
      : entry.name.endsWith(".tsx") ? [path.join(directory, entry.name)] : []);
  const missing = new Set<string>();
  for (const filename of appFiles("app")) {
    const tree = ts.createSourceFile(filename, readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node) => {
      let text: string | undefined;
      if (ts.isStringLiteralLike(node)) text = node.text;
      if (ts.isJsxText(node)) text = node.text.trim().replace(/\s+/g, " ");
      if (text && /[\u0600-\u06ff]/.test(text) && !keys.has(text)) missing.add(`${filename}: ${text}`);
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  assert.deepEqual([...missing], []);
});

test("static and template translation preserves interpolated user data exactly", () => {
  const { translate, translateStatic, translateTemplate, setTranslationLanguage } = localizationForTest();
  setTranslationLanguage("fr");
  assert.equal(translateStatic("الإعدادات"), "Paramètres");
  assert.equal(translateTemplate("فتح {{0}}", ["قطع غيار"]), "Ouvrir قطع غيار");
  assert.equal(translate("اسم غير مترجم كتبه المستخدم", "fr"), "اسم غير مترجم كتبه المستخدم");
  setTranslationLanguage("ar");
  assert.equal(translateStatic("الإعدادات"), "الإعدادات");
});

test("build-time localization touches interface copy, never payload enums or input values", () => {
  const require = createRequire(path.resolve("package.json"));
  const babel = require("@babel/core");
  const plugin = require("./lib/babel-plugin-localize-jsx.cjs");
  const compiled = babel.transformSync(`
    const payload = {category: "قطع غيار"};
    const Demo = ({record}) => <View>
      <Text>الإعدادات</Text>
      <TextInput value={record.name} placeholder="اسم السلعة" />
      <Text>{record.notes}</Text>
      <Text>{\`فتح \${record.name}\`}</Text>
    </View>;
  `, {
    filename: path.resolve("app/localization-test-fixture.tsx"),
    configFile: false, babelrc: false, parserOpts: { plugins: ["typescript", "jsx"] }, plugins: [plugin],
  }).code;
  assert.match(compiled, /translateStatic/);
  assert.match(compiled, /translateTemplate/);
  assert.match(compiled, /category: "قطع غيار"/);
  assert.match(compiled, /value=\{record\.name\}/);
  assert.match(compiled, /\{record\.notes\}/);
  assert.doesNotMatch(compiled, /TranslateStatic\(record\.(name|notes)\)/);
});
