# Desktop viewport investigation

## Confirmed findings

- The website is an Expo SDK 54 / React Native Web single-page application.
- Its original exported Expo HTML reset used `body { overflow: hidden }`.
  Root layout also set a percentage minimum height; the sidebar used a percentage
  height. These were constraints to harden, not proof of the photographed strip.
- Before changes, browser measurements at 1280×800, 1366×768 and 1920×1080
  already had matching inner/client/document/root heights. The account footer
  was in the viewport and no page-owned white strip was reproduced.
- No Websktop project, native window configuration, or Windows executable is
  present in this repository. The photographs show only part of the window;
  they do not identify the boundary between native and web content.

**The source of the photographed strip has not yet been established. Do not
report a confirmed Windows/Websktop fix from browser tests alone.**

## Changes

- `public/index.html`: owned Expo SPA template, zero margins, border-box sizing,
  no hidden page overflow, bounded root height with vh/dvh fallback.
- `public/app-viewport.js`: sizes the root from actual inner/client viewport
  dimensions and unzoomed visual viewport; updates on resize, orientation,
  fullscreen and restore. Never uses native outer/screen height for CSS sizing.
- `app/_layout.tsx`, `app/components/WorkspaceShell.tsx`: shrinkable flex chain
  with explicit zero minimum dimensions.
- `app/components/AppSidebar.tsx`: stretched sidebar rather than a percentage
  height; account/brand do not shrink and only navigation scrolls.
- `app/components/BottomNavigation.tsx`: bottom navigation retains its own
  space in normal flow; not a fixed overlay.

No controls, records, permissions, or business behavior were removed or changed.
The changes take effect on the live site only after its frontend is rebuilt
and published through its existing deployment process.

## Repeatable checks

```
npm run typecheck
npx tsx --test server/tests/web-viewport.test.ts
node scripts/test-workspace-layout.cjs
```

The browser check intercepts API requests with test fixtures. It does not create
users, access business data, or change application authentication. Its captured
screens are layout checks, not authenticated backend integration tests.

Required post-change measurements (CSS pixels):

| Viewport | innerHeight | clientHeight | scrollHeight | Root bottom | Account bottom |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1280×800 | 800 | 800 | 800 | 800 | 788 |
| 1366×768 | 768 | 768 | 768 | 768 | 756 |
| 1920×1080 | 1080 | 1080 | 1080 | 1080 | 1068 |

Also checks 1024×500, 1280×400, restoration to 1366×768, compact navigation,
the last main-content element, the last sidebar link, no unintended horizontal
overflow, and Chromium minimize/restore/maximize/fullscreen state transitions.
Outputs: `generated-artifacts/workspace-layout/metrics.json` and screenshots.
The engine is headless Chromium on Linux, **not Windows 10 or Websktop**.

## Remaining native-host investigation

Obtain a full capture including the app frame and Windows taskbar, plus the
Websktop Window configuration or native project. Without these, a specific
host-setting change would be a guess.

When an inspector is available in a diagnostic build, collect:

```
JSON.stringify(window.benniniViewportMetrics(), null, 2)
```

Compare normal, maximized and fullscreen. `outerHeight - innerHeight` includes
native chrome and is not itself a page defect. Check native webview content
bounds against the native client rectangle and Windows scaling/DPI. If a strip
is outside the DOM and the web root fits the usable viewport, fix its native
owner rather than introducing compensating page padding.

The public [Websktop builder](https://websktop.net/build) currently documents
Width/Height, Resizable window, Start in fullscreen, Center on launch and
Window decorations. These labels are confirmed options, **not a confirmed
remedy for the reported strip**. No documented strip-specific setting was found.
