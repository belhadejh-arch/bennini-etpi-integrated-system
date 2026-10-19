const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const babel = require("@babel/core");

const root = path.resolve(__dirname, "..");
const arabic = /[\u0600-\u06ff]/;
const localizedAttributes = new Set([
  "accessibilityLabel", "accessibilityHint", "placeholder", "label", "emptyLabel",
  "title", "description", "hint", "dialogTitle", "confirmText", "cancelText",
  "headerTitle", "errorMessage", "helperText",
]);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : absolute.endsWith(".tsx") ? [absolute] : [];
  });
}

function normalizeJsxText(raw) {
  const input = raw.replace(/\r/g, "");
  if (!input.includes("\n")) return input;
  const lines = input.split("\n");
  return lines.map((line, index) => {
    let result = line;
    if (index !== 0) result = result.replace(/^\s+/, "");
    if (index !== lines.length - 1) result = result.replace(/\s+$/, "");
    return result;
  }).filter((line) => line.length > 0).join(" ");
}

function templateKey(node) {
  let key = node.head.text;
  node.templateSpans.forEach((span, index) => {
    key += `{{${index}}}${span.literal.text}`;
  });
  return key;
}

function extractDictionary(file, variable) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const keys = new Set();
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === variable &&
        node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
      for (const property of node.initializer.properties) {
        if (ts.isPropertyAssignment(property) && ts.isStringLiteral(property.name)) keys.add(property.name.text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return keys;
}

const appFiles = walk(path.join(root, "app"));
const sourceKeys = new Set();
const sourceTemplates = new Set();
const renderableStatic = new Set();

function addKey(value, trim = true) {
  const key = value && (trim ? value.trim() : value);
  if (key && arabic.test(key)) sourceKeys.add(key);
}

function addRenderable(value, trim = true) {
  const key = value && (trim ? value.trim() : value);
  if (key && arabic.test(key)) renderableStatic.add(key);
}

function visitRenderedExpression(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    addRenderable(node.text, false);
  } else if (ts.isTemplateExpression(node)) {
    const key = templateKey(node);
    addRenderable(key, false);
    if (arabic.test(key)) sourceTemplates.add(key);
  } else if (ts.isParenthesizedExpression(node)) {
    visitRenderedExpression(node.expression);
  } else if (ts.isConditionalExpression(node)) {
    visitRenderedExpression(node.whenTrue);
    visitRenderedExpression(node.whenFalse);
  } else if (ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.BarBarToken || node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) {
    visitRenderedExpression(node.right);
  } else if (ts.isArrayLiteralExpression(node)) {
    node.elements.forEach(visitRenderedExpression);
  }
}

const emittedStatic = new Set();
const emittedTemplates = new Set();

for (const file of appFiles) {
  const relative = path.relative(root, file);
  const sourceText = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function collect(node) {
    if (ts.isJsxText(node)) {
      const value = normalizeJsxText(node.text);
      addKey(value);
      addRenderable(value);
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      addKey(node.text, false);
    } else if (ts.isTemplateExpression(node)) {
      const key = templateKey(node);
      addKey(key, false);
      if (arabic.test(key)) sourceTemplates.add(key);
    }
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && localizedAttributes.has(node.name.text)) {
      if (node.initializer && ts.isStringLiteral(node.initializer)) addRenderable(node.initializer.text, false);
      else if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        visitRenderedExpression(node.initializer.expression);
      }
    }
    if (ts.isJsxExpression(node) && node.expression) visitRenderedExpression(node.expression);
    ts.forEachChild(node, collect);
  }
  collect(source);

  const transformed = babel.transformFileSync(file, {
    configFile: path.join(root, "babel.config.js"),
    babelrc: false,
    filename: file,
  });
  const output = transformed && transformed.code || "";
  const compiledSource = ts.createSourceFile(`${relative}.js`, output, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function collectCalls(node) {
    if (ts.isCallExpression(node) && node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
      const callee = node.expression.getText(compiledSource);
      const key = node.arguments[0].text;
      if (callee.includes("translateStatic") && arabic.test(key)) emittedStatic.add(key);
      if (callee.includes("translateTemplate") && arabic.test(key)) emittedTemplates.add(key);
    }
    ts.forEachChild(node, collectCalls);
  }
  collectCalls(compiledSource);
}

const dictionaryKeys = new Set([
  ...extractDictionary(path.join(root, "shared/ui-translations-fr.ts"), "uiFrench"),
  ...extractDictionary(path.join(root, "shared/api-error-translations.ts"), "apiErrorFrench"),
  ...extractDictionary(path.join(root, "lib/localization.ts"), "fr"),
]);
const missingDictionary = [...sourceKeys].filter((key) => !dictionaryKeys.has(key)).sort();
const missingStaticWiring = [...renderableStatic].filter((key) => !emittedStatic.has(key) && !emittedTemplates.has(key)).sort();
const missingTemplateWiring = [...sourceTemplates].filter((key) => !emittedTemplates.has(key)).sort();

console.log(`Scanned ${appFiles.length} TSX screens/components.`);
console.log(`Arabic source keys: ${sourceKeys.size}; localized dictionary keys: ${dictionaryKeys.size}.`);
console.log(`Babel-wired static labels: ${emittedStatic.size}; template patterns: ${emittedTemplates.size}.`);
if (missingDictionary.length || missingStaticWiring.length || missingTemplateWiring.length) {
  if (missingDictionary.length) console.error("Missing French dictionary entries:\n" + missingDictionary.join("\n"));
  if (missingStaticWiring.length) console.error("Static JSX strings not passed through translation:\n" + missingStaticWiring.join("\n"));
  if (missingTemplateWiring.length) console.error("Dynamic templates not passed through translateTemplate:\n" + missingTemplateWiring.join("\n"));
  process.exitCode = 1;
} else {
  console.log("UI translation coverage passed.");
}
