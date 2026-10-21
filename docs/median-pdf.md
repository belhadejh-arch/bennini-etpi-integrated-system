# PDF preview and printing in Median

The mobile wrapper is generated with Median.co. Report/PDF preview must not depend on popups, Google Docs, Blob URLs passed to the native downloader, or Android WebView's unsupported built-in PDF plugin.

## User flow

- Preview reports and existing PDF attachments in the in-page PDF.js viewer.
- Use page navigation, zoom, fit-width, and close/back without leaving the app.
- “معاينة” opens the in-page preview; “طباعة” uses Median's native PDF viewer, which provides the system Print action.
- “حفظ وتنزيل PDF” downloads the actual file without first opening the preview. In Median this calls the native download/share flow. Browser printing uses the actual PDF in a same-origin frame.
- The Expo-native flow remains based on expo-print/expo-sharing.

## Median configuration

Use a current Median app build with JavaScript Bridge injection enabled. Bridge URL restrictions, if configured, must allow the site's document/section pages. Both `median` and legacy `gonative` namespaces are supported. If the library has not initialized, same-window navigation to the inline PDF is the documented fallback.

The URL is resolved against the current website origin, so Median must point at the running site's HTTPS domain. No separate API credentials are required.

The device needs a printing service and a compatible printer. On iOS, the native PDF viewer places Print at bottom-right; Android places it at top-right, as documented by Median. The native print sheet controls printer, copies, paper and orientation to the extent supported by the device/printer.

## Privacy and operational requirements

PDFs are generated on this app's server using the Nix-managed Chromium dependency. There is no third-party document rendering service.

For a separate Node/Render deployment, run `npm run setup:pdf-browser` during the build (included in render.yaml). It uses an available system browser or installs the matching Chrome build in an ignored generated-artifacts directory. The host must provide Chrome's supported Linux libraries. Browser binaries must not be committed.

When the website and API are hosted separately, the viewer assets and protected document URLs follow the configured API address. The API's CORS allowlist must include the website's origin. Browser printing fetches the PDF into a local Blob frame to avoid cross-origin frame printing restrictions; Median always receives the real HTTPS URL, never a Blob.

Preview, print and download reuse a prepared, unexpired PDF for the same selection/settings during the current print session. Reopening the report or changing selection/settings generates a fresh document. PDF creation has a longer bounded request timeout than ordinary JSON reads.

Median downloads natively and does not forward the website's Bearer header. The app therefore creates a five-minute, unguessable document-scoped capability URL after checking the user's permissions. Only a hash of the token is stored. The URL stops working on expiry, account deactivation/deletion or permission changes, and responses are no-store/no-referrer. Expired temporary documents are periodically removed.

Do not put session tokens in URLs or loosen record authorization to make downloads work.

## Verification

Automated checks exercise actual server-generated PDF bytes, authorization/expiry/revocation, rendering of the saved daily shifts, PDF attachment preview, responsive canvas layouts and simulated Median bridge calls. These checks are not a physical-device test of the user's installed Median build or printer.

Official references:
- https://docs.median.co/docs/download-file
- https://docs.median.co/docs/javascript-bridge
- https://docs.median.co/docs/detecting-app-usage
