const path = require("node:path");

const ARABIC = /[\u0600-\u06ff]/;
const LABEL_ATTRIBUTES = new Set([
  "accessibilityLabel", "accessibilityHint", "placeholder", "label", "emptyLabel",
  "title", "description", "hint", "dialogTitle", "confirmText", "cancelText",
  "headerTitle", "errorMessage", "helperText",
]);

function normalizedJsxText(raw) {
  const input = raw.replace(/\r/g, "");
  if (!input.includes("\n")) return input;
  const lines = input.split("\n");
  const clean = lines.map((line, index) => {
    let result = line;
    if (index !== 0) result = result.replace(/^\s+/, "");
    if (index !== lines.length - 1) result = result.replace(/\s+$/, "");
    return result;
  }).filter((line) => line.length > 0);
  return clean.join(" ");
}

function isAlreadyTranslated(node) {
  return Boolean(node && node.extra && node.extra.benniniTranslationKey);
}

module.exports = function localizeStaticUi({ types: t }) {
  return {
    name: "bennini-localize-static-jsx",
    visitor: {
      Program: {
        enter(programPath, state) {
          const filename = state.file.opts.filename || "";
          const normalizedFilename = filename.replace(/\\/g, "/");
          if (!normalizedFilename.includes("/app/")) return;
          const root = process.cwd();
          let relative = path.relative(path.dirname(filename), path.join(root, "lib/localization"));
          relative = relative.split(path.sep).join("/");
          if (!relative.startsWith(".")) relative = `./${relative}`;
          const alias = "__benniniTranslateStatic";
          const templateAlias = "__benniniTranslateTemplate";
          const textAlignAlias = "__benniniTextAlign";
          const textDirectionAlias = "__benniniTextDirection";
          const themeColorAlias = "__benniniThemeColor";
          let changed = false;
          let styleChanged = false;
          let themeColorChanged = false;

          const callForText = (key) => {
            const literal = t.stringLiteral(key);
            literal.extra = { ...(literal.extra || {}), benniniTranslationKey: true };
            changed = true;
            return t.callExpression(t.identifier(alias), [literal]);
          };
          const callForTemplate = (pattern, values) => {
            const literal = t.stringLiteral(pattern);
            literal.extra = { ...(literal.extra || {}), benniniTranslationKey: true };
            changed = true;
            return t.callExpression(t.identifier(templateAlias), [literal, t.arrayExpression(values)]);
          };
          const localizeStyle = (node) => {
            // The logo needs a genuinely white backing in both themes.
            if (normalizedFilename.endsWith("/app/components/CompanyLogo.tsx")) return;
            if (t.isArrayExpression(node)) {
              node.elements.forEach((element) => { if (element && t.isExpression(element)) localizeStyle(element); });
              return;
            }
            if (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) {
              localizeStyle(node.body);
              return;
            }
            if (t.isConditionalExpression(node)) {
              localizeStyle(node.consequent);
              localizeStyle(node.alternate);
              return;
            }
            if (t.isLogicalExpression(node)) {
              localizeStyle(node.right);
              return;
            }
            if (!t.isObjectExpression(node)) return;
            const hasFontSize = node.properties.some((property) => t.isObjectProperty(property) &&
              t.isIdentifier(property.key) && property.key.name === "fontSize");
            node.properties.forEach((property) => {
              if (!t.isObjectProperty(property)) return;
              const name = t.isIdentifier(property.key) ? property.key.name : t.isStringLiteral(property.key) ? property.key.value : "";
              if (name === "height" && hasFontSize) {
                property.key = t.identifier("minHeight");
                changed = true;
              }
              if (["backgroundColor", "color", "borderColor"].includes(name) && t.isStringLiteral(property.value) &&
                  /^#[\da-f]{6}$/i.test(property.value.value)) {
                property.value = t.callExpression(t.identifier(themeColorAlias), [
                  t.stringLiteral(property.value.value),
                  t.stringLiteral(name),
                ]);
                themeColorChanged = true;
                changed = true;
              } else if (name === "fontSize" && t.isNumericLiteral(property.value) && property.value.value < 14) {
                property.value = t.numericLiteral(14);
                changed = true;
              } else if (name === "lineHeight" && t.isNumericLiteral(property.value) && property.value.value < 22) {
                property.value = t.numericLiteral(22);
                changed = true;
              } else if (name === "textAlign" && t.isStringLiteral(property.value) &&
                  ["left", "right"].includes(property.value.value)) {
                property.value = t.callExpression(t.identifier(textAlignAlias), [t.stringLiteral(property.value.value)]);
                styleChanged = true;
                changed = true;
              } else if ((name === "writingDirection" || name === "direction") &&
                  t.isStringLiteral(property.value) && ["rtl", "ltr"].includes(property.value.value)) {
                property.value = t.callExpression(t.identifier(textDirectionAlias), []);
                styleChanged = true;
                changed = true;
              } else {
                localizeStyle(property.value);
              }
            });
          };

          const localizeRenderedExpression = (expression) => {
            if (!expression || isAlreadyTranslated(expression)) return expression;
            if (t.isStringLiteral(expression)) {
              return ARABIC.test(expression.value) ? callForText(expression.value) : expression;
            }
            if (t.isTemplateLiteral(expression)) {
              const values = [];
              let pattern = "";
              expression.quasis.forEach((quasi, index) => {
                pattern += quasi.value.cooked || quasi.value.raw;
                if (index < expression.expressions.length) {
                  pattern += `{{${index}}}`;
                  values.push(localizeRenderedExpression(expression.expressions[index]));
                }
              });
              return ARABIC.test(pattern) ? callForTemplate(pattern, values) : expression;
            }
            if (t.isParenthesizedExpression(expression)) {
              expression.expression = localizeRenderedExpression(expression.expression);
              return expression;
            }
            if (t.isConditionalExpression(expression)) {
              expression.consequent = localizeRenderedExpression(expression.consequent);
              expression.alternate = localizeRenderedExpression(expression.alternate);
              return expression;
            }
            if (t.isLogicalExpression(expression)) {
              expression.right = localizeRenderedExpression(expression.right);
              return expression;
            }
            if (t.isArrayExpression(expression)) {
              expression.elements = expression.elements.map((element) =>
                element && t.isExpression(element) ? localizeRenderedExpression(element) : element,
              );
              return expression;
            }
            return expression;
          };

          programPath.traverse({
            JSXText(nodePath) {
              const text = normalizedJsxText(nodePath.node.value);
              if (!text || !ARABIC.test(text)) return;
              const phrase = text.trim();
              if (!phrase) return;
              const leading = text.slice(0, text.indexOf(phrase));
              const trailing = text.slice(text.indexOf(phrase) + phrase.length);
              let localized = callForText(phrase);
              if (leading) localized = t.binaryExpression("+", t.stringLiteral(leading), localized);
              if (trailing) localized = t.binaryExpression("+", localized, t.stringLiteral(trailing));
              nodePath.replaceWith(t.jsxExpressionContainer(localized));
            },
            JSXAttribute(nodePath) {
              const name = nodePath.node.name;
              if (t.isJSXIdentifier(name) && name.name === "textAlign" &&
                  t.isStringLiteral(nodePath.node.value) && ["left", "right"].includes(nodePath.node.value.value)) {
                nodePath.node.value = t.jsxExpressionContainer(
                  t.callExpression(t.identifier(textAlignAlias), [t.stringLiteral(nodePath.node.value.value)]),
                );
                styleChanged = true;
                changed = true;
                return;
              }
              if (t.isJSXIdentifier(name) && name.name === "writingDirection" &&
                  t.isStringLiteral(nodePath.node.value) && ["rtl", "ltr"].includes(nodePath.node.value.value)) {
                nodePath.node.value = t.jsxExpressionContainer(t.callExpression(t.identifier(textDirectionAlias), []));
                styleChanged = true;
                changed = true;
                return;
              }
              if (t.isJSXIdentifier(name) && name.name === "style" &&
                  t.isJSXExpressionContainer(nodePath.node.value)) {
                localizeStyle(nodePath.node.value.expression);
              }
              if (t.isJSXExpressionContainer(nodePath.node.value) &&
                  !t.isJSXEmptyExpression(nodePath.node.value.expression)) {
                nodePath.node.value.expression = localizeRenderedExpression(nodePath.node.value.expression);
              }
              if (!t.isJSXIdentifier(name) || !LABEL_ATTRIBUTES.has(name.name)) return;
              const value = nodePath.node.value;
              if (t.isStringLiteral(value) && ARABIC.test(value.value)) {
                nodePath.node.value = t.jsxExpressionContainer(callForText(value.value));
              } else if (t.isJSXExpressionContainer(value)) {
                value.expression = localizeRenderedExpression(value.expression);
              }
            },
            JSXExpressionContainer(nodePath) {
              const expression = nodePath.node.expression;
              if (t.isJSXEmptyExpression(expression)) return;
              nodePath.node.expression = localizeRenderedExpression(expression);
            },
            CallExpression(nodePath) {
              const callee = nodePath.node.callee;
              const method = t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.property)
                ? callee.property.name
                : t.isIdentifier(callee) ? callee.name : "";
              if (["setError", "setSuccess", "setNotice", "setMessage", "setAlert"].includes(method)) {
                nodePath.node.arguments = nodePath.node.arguments.map((argument) =>
                  t.isExpression(argument) ? localizeRenderedExpression(argument) : argument,
                );
                return;
              }
              if (t.isMemberExpression(callee) && t.isIdentifier(callee.object) &&
                  ["Alert", "Window", "window", "globalThis"].includes(callee.object.name) &&
                  ["alert", "confirm", "prompt"].includes(method)) {
                nodePath.node.arguments = nodePath.node.arguments.map((argument) => {
                  if (t.isIdentifier(argument)) {
                    const binding = nodePath.scope.getBinding(argument.name);
                    if (binding && binding.path.isVariableDeclarator() && t.isExpression(binding.path.node.init)) {
                      binding.path.node.init = localizeRenderedExpression(binding.path.node.init);
                    }
                    return argument;
                  }
                  if (t.isArrayExpression(argument)) {
                    argument.elements.forEach((entry) => {
                      if (!t.isObjectExpression(entry)) return;
                      entry.properties.forEach((property) => {
                        if (t.isObjectProperty(property) && !property.computed &&
                            t.isIdentifier(property.key) && ["text", "title", "message"].includes(property.key.name) &&
                            t.isExpression(property.value)) {
                          property.value = localizeRenderedExpression(property.value);
                        }
                      });
                    });
                    return argument;
                  }
                  return t.isExpression(argument) ? localizeRenderedExpression(argument) : argument;
                });
              }
            },
            NewExpression(nodePath) {
              if (t.isIdentifier(nodePath.node.callee) && nodePath.node.callee.name === "Error" &&
                  nodePath.node.arguments.length > 0 && t.isExpression(nodePath.node.arguments[0])) {
                nodePath.node.arguments[0] = localizeRenderedExpression(nodePath.node.arguments[0]);
              }
            },
          });

          if (!changed) return;
          const importDeclaration = t.importDeclaration(
            [
              t.importSpecifier(t.identifier(alias), t.identifier("translateStatic")),
              t.importSpecifier(t.identifier(templateAlias), t.identifier("translateTemplate")),
              ...(styleChanged ? [
                t.importSpecifier(t.identifier(textAlignAlias), t.identifier("localizedTextAlign")),
                t.importSpecifier(t.identifier(textDirectionAlias), t.identifier("localizedTextDirection")),
              ] : []),
              ...(themeColorChanged ? [t.importSpecifier(t.identifier(themeColorAlias), t.identifier("resolveThemeColor"))] : []),
            ],
            t.stringLiteral(relative),
          );
          const importIndex = programPath.node.body.findIndex((node) => !t.isImportDeclaration(node));
          programPath.node.body.splice(importIndex < 0 ? programPath.node.body.length : importIndex, 0, importDeclaration);
        },
      },
    },
  };
};
