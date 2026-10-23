import { Platform } from "react-native";
export type ThemeMode = "light" | "dark";
export const appFontFamily = "Changa";
export const palettes = {
  light: {
    navy: "#183449", deepBlue: "#123C58", blue: "#174D6A", royal: "#245E7C",
    yellow: "#F2C45A", grayBlue: "#526B7A", lightBlue: "#D2DFE7", lightBeige: "#F3D98D",
    background: "#EEF3F3", surface: "#FAF8F1", ink: "#28414C", muted: "#526B7A", blueSoft: "#E5EEF2",
    border: "#C7D4D8", green: "#17613F", greenSoft: "#E5F0E7", red: "#A53138",
    redSoft: "#F8E8E7", amber: "#704600", amberSoft: "#F6E9C9", violet: "#58458A",
    placeholder: "#5C6D76", white: "#FAF8F1", action: "#174D6A", onAccent: "#183448",
  },
  dark: {
    navy: "#DCE8EB", deepBlue: "#142D3C", blue: "#79B7CF", royal: "#31596D",
    yellow: "#F2C45A", grayBlue: "#B8C8CE", lightBlue: "#C5D3D9", lightBeige: "#F3D98D",
    background: "#172630", surface: "#223640", ink: "#D8E3E5", muted: "#C1CED1", blueSoft: "#294451",
    border: "#49606A", green: "#8ED6A7", greenSoft: "#294939", red: "#FF9B96",
    redSoft: "#522F32", amber: "#F4CE75", amberSoft: "#4C422A", violet: "#D2C1F3",
    placeholder: "#B6C6CB", white: "#F8F6EF", action: "#31596D", onAccent: "#183449",
  },
} as const;
let activePalette: keyof typeof palettes = "light";
let activeLanguage: "ar" | "fr" = "ar";
const inlineBackgrounds: Record<string, keyof typeof palettes.light> = {
  "#ffffff": "surface", "#fbfcfe": "surface", "#fcfbf6": "surface", "#f8fafc": "background",
  "#f5f7f8": "background", "#edf2f8": "background", "#e5edf6": "background",
  "#f0f4f9": "background", "#eef3fb": "background", "#f3f6fa": "background",
  "#f1f6fb": "background", "#f6f9fd": "background", "#f7fafd": "background", "#f4f6f9": "background",
  "#f5f6f8": "background", "#fafbfd": "surface", "#eef1f5": "background", "#f1f4f8": "background",
  "#e5484d": "red", "#f2f6fc": "blueSoft", "#f2f7fd": "blueSoft",
  "#f3f7fc": "blueSoft", "#f4f7fb": "blueSoft", "#f5f8fc": "blueSoft", "#f5f9fe": "blueSoft",
  "#f6f8fb": "blueSoft", "#f6faff": "blueSoft", "#f7f9fc": "blueSoft", "#f8fafd": "blueSoft",
  "#e9f0f5": "blueSoft", "#edf0f4": "background", "#e8edf3": "background",
  "#eaf1fb": "blueSoft", "#e7f0fb": "blueSoft", "#eaf1fa": "blueSoft", "#eaf1ff": "blueSoft",
  "#eaf2fc": "blueSoft", "#edf4fc": "blueSoft", "#eff6ff": "blueSoft", "#f1f5fc": "blueSoft",
  "#fff8e9": "amberSoft", "#fff0c9": "amberSoft", "#fff2d3": "amberSoft", "#fff9e8": "amberSoft",
  "#fff3d7": "amberSoft", "#eaf7f0": "greenSoft", "#dcf5e9": "greenSoft", "#e4f6ec": "greenSoft",
  "#ecfdf3": "greenSoft", "#e9f4ed": "greenSoft", "#f2faf5": "greenSoft", "#fdebec": "redSoft",
  "#fce8e7": "redSoft", "#fcebe9": "redSoft", "#fef0ef": "redSoft", "#fef2f2": "redSoft",
  "#fff1f0": "redSoft", "#fff7f7": "redSoft", "#fff8f8": "redSoft",
};
const inlineTextColors: Record<string, keyof typeof palettes.light> = {
  "#0f766e": "green", "#15803d": "green", "#178653": "green", "#7c3aed": "violet",
  "#b45309": "amber", "#81393b": "red", "#9e292e": "red", "#e5484d": "red",
  "#ba4c44": "red", "#98a5b4": "placeholder", "#a6b2c1": "muted", "#aab4c1": "muted",
};
export function setActiveLanguage(language: "ar" | "fr") {
  activeLanguage = language;
  if (Platform.OS === "web" && typeof document !== "undefined") {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }
}
export function setActivePalette(mode: keyof typeof palettes) {
  activePalette = mode;
  if (Platform.OS === "web" && typeof document !== "undefined") {
    const root = document.documentElement;
    root.dataset.theme = mode;
    Object.entries(palettes[mode]).forEach(([name, value]) => root.style.setProperty(`--bennini-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, value));
    root.style.colorScheme = mode;
  }
}
export const colors = new Proxy({} as typeof palettes.light, {
  get: (_target, property: keyof typeof palettes.light) => {
    if (Platform.OS === "web") return `var(--bennini-${String(property).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)})`;
    return palettes[activePalette][property];
  },
});
export function resolveThemeColor(value: string, property: "backgroundColor" | "color" | "borderColor") {
  const normalized = value.toLowerCase();
  if (property === "backgroundColor" && inlineBackgrounds[normalized]) return palettes[activePalette][inlineBackgrounds[normalized]];
  if (property === "color" && inlineTextColors[normalized]) return palettes[activePalette][inlineTextColors[normalized]];
  const semantic = Object.entries(palettes.light).find(([, token]) => token.toLowerCase() === normalized)?.[0] as keyof typeof palettes.light | undefined;
  if (semantic) return palettes[activePalette][semantic];
  if (property === "borderColor") return palettes[activePalette].border;
  return value;
}
type StyleTree = Record<string, unknown>;
/**
 * Module-level React Native styles are normally frozen at import time. This
 * proxy re-resolves semantic palette values whenever a style is read, so
 * changing appearance updates mounted screens without remounting their forms.
 */
export function makeStylesReactive<T extends StyleTree>(definitions: T): T {
  const lightEntries = Object.entries(palettes.light) as Array<[keyof typeof palettes.light, string]>;
  const resolve = (value: string, property: string) => {
    if (property === "backgroundColor" && value.toLowerCase() === palettes.light.action.toLowerCase()) return colors.action;
    if (property === "color" && inlineTextColors[value.toLowerCase()]) return colors[inlineTextColors[value.toLowerCase()]];
    const semantic = lightEntries.find(([, token]) => token.toLowerCase() === value.toLowerCase())?.[0];
    if (semantic) return colors[semantic];
    return property === "borderColor" ? colors.border : value;
  };
  const clone = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(clone);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
    return value;
  };
  const visit = (record: Record<string, unknown>) => {
    if (typeof record.fontSize === "number") {
      if (typeof record.height === "number") {
        record.minHeight = Math.max(Number(record.minHeight) || 0, record.height);
        delete record.height;
      }
      const originalSize = record.fontSize;
      const safeSize = Math.max(13, originalSize);
      if (originalSize < 13) {
        Object.defineProperty(record, "fontSize", { enumerable: true, configurable: false, get: () => Math.max(13, originalSize) });
      }
      if (typeof record.lineHeight !== "number" || record.lineHeight < safeSize * 1.55) {
        const originalLineHeight = record.lineHeight;
        Object.defineProperty(record, "lineHeight", { enumerable: true, configurable: false, get: () => Math.max(typeof originalLineHeight === "number" ? originalLineHeight : 0, safeSize * 1.6) });
      }
      if (record.fontWeight === undefined || record.fontWeight === "normal" || (typeof record.fontWeight === "string" && Number(record.fontWeight) < 500) || (typeof record.fontWeight === "number" && record.fontWeight < 500)) {
        Object.defineProperty(record, "fontWeight", { enumerable: true, configurable: false, get: () => "500" });
      }
    }
    Object.keys(record).forEach((key) => {
      const initial = record[key];
      if (key === "direction" && (initial === "rtl" || initial === "ltr")) {
        Object.defineProperty(record, key, { enumerable: true, configurable: false, get: () => activeLanguage === "ar" ? "rtl" : "ltr" });
        return;
      }
      if (key === "writingDirection" && (initial === "rtl" || initial === "ltr")) {
        Object.defineProperty(record, key, { enumerable: true, configurable: false, get: () => activeLanguage === "ar" ? "rtl" : "ltr" });
        return;
      }
      if (key === "textAlign" && (initial === "right" || initial === "left")) {
        Object.defineProperty(record, key, { enumerable: true, configurable: false, get: () => activeLanguage === "ar" ? (initial === "right" ? "right" : "left") : (initial === "right" ? "left" : "right") });
        return;
      }
      if (typeof initial === "string" && /^#[\da-f]{6}$/i.test(initial)) {
        const bg = key === "backgroundColor" ? initial.toLowerCase() : "";
        Object.defineProperty(record, key, {
          enumerable: true, configurable: false,
          get: () => bg && inlineBackgrounds[bg] ? colors[inlineBackgrounds[bg]] : resolve(initial, key),
        });
      } else if (Array.isArray(initial)) {
        initial.forEach((item) => { if (item && typeof item === "object") visit(item as Record<string, unknown>); });
      } else if (initial && typeof initial === "object") {
        visit(initial as Record<string, unknown>);
        Object.defineProperty(record, key, { enumerable: true, configurable: false, get: () => clone(initial) });
      }
    });
  };
  visit(definitions);
  return definitions;
}

export function formatDzd(value: number, language: "ar" | "fr" = activeLanguage, maximumFractionDigits = 0) {
  const number = new Intl.NumberFormat(language === "ar" ? "ar-DZ" : "fr-DZ", { maximumFractionDigits }).format(value);
  return language === "ar" ? `${number} دج` : `${number} DA`;
}
export function formatExactDzd(value: number, language: "ar" | "fr" = activeLanguage) {
  return formatDzd(value, language, 2);
}
export function formatDateTime(value: string | Date, language: "ar" | "fr" = activeLanguage) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(language === "ar" ? "ar-DZ" : "fr-DZ", { dateStyle: "medium", timeStyle: "short" });
}
export function formatDate(value: string | null, language: "ar" | "fr" = activeLanguage) {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(language === "ar" ? "ar-DZ" : "fr-DZ");
}
