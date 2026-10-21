import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type {PDFDocumentProxy,PDFDocumentLoadingTask,PDFPageProxy,RenderTask} from "pdfjs-dist/legacy/build/pdf.mjs";
import {loadPdfJs} from "../../lib/pdfjs-loader.web";
import { useAuth } from "../../lib/auth";
import { formatDateTime, colors, appFontFamily } from "../../lib/theme";
import { translate } from "../../lib/localization";

export interface DocumentPreviewProps {
  document: { url: string; title: string; expiresAt: string };
  onClose: () => void;
  onDownload: () => Promise<void>;
  onNativeOpen?: () => Promise<void>;
}


export default function DocumentPreview({ document: file, onClose, onDownload, onNativeOpen }: DocumentPreviewProps) {
  const { language } = useAuth();
  const t = useCallback((text: string) => translate(text, language), [language]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pageAreaRef = useRef<HTMLDivElement | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [fitWidth, setFitWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [busyAction, setBusyAction] = useState<"download" | "native" | null>(null);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const closeRef=useRef(onClose);
  closeRef.current=onClose;

  useEffect(()=>{
    const marker=`document-preview:${Date.now()}`;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    history.pushState({...history.state,benniniDocumentPreview:marker},"");
    const back=()=>{if(history.state?.benniniDocumentPreview!==marker)closeRef.current();};
    window.addEventListener("popstate",back);
    return()=>{
      document.body.style.overflow=previousOverflow;
      window.removeEventListener("popstate",back);
      if(history.state?.benniniDocumentPreview===marker)history.back();
    };
  },[file.url]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    setPdf(null);
    setPageNumber(1);
    let task:PDFDocumentLoadingTask|undefined;
    void loadPdfJs().then((library)=>{
      if(!mounted)return;
      library.GlobalWorkerOptions.workerSrc="/pdf-assets/pdf.worker.min.mjs";
      task = library.getDocument({
      url: file.url,
      cMapUrl: "/pdf-assets/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/pdf-assets/standard_fonts/",
      wasmUrl: "/pdf-assets/wasm/",
      isEvalSupported: false,
    });
      return task.promise;
    }).then((loaded) => {
      if(!loaded)return;
      if (mounted) {
        setPdf(loaded);
        setLoading(false);
      } else {
        void loaded.destroy();
      }
    }).catch((caught: unknown) => {
      if (mounted) {
        setError(caught instanceof Error ? caught.message : t("تعذر تحميل المستند."));
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
      void task?.destroy();
    };
  }, [file.url, retryKey, t]);

  useEffect(() => {
    const node = pageAreaRef.current;
    if (!node) return;
    const updateWidth = () => setFitWidth(node.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pdf || !canvasRef.current || !fitWidth) return;
    let active = true;
    let renderTask: RenderTask | null = null;
    let page: PDFPageProxy | null = null;
    setRendering(true);
    setError("");
    pdf.getPage(pageNumber).then((loadedPage) => {
      page = loadedPage;
      if (!active || !canvasRef.current) return;
      const unscaled = loadedPage.getViewport({ scale: 1 });
      const scale = Math.max(0.2, (fitWidth - 40) / unscaled.width) * zoom;
      const viewport = loadedPage.getViewport({ scale });
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = canvasRef.current;
      canvas.width = Math.ceil(viewport.width * pixelRatio);
      canvas.height = Math.ceil(viewport.height * pixelRatio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const context = canvas.getContext("2d");
      if (!context) throw new Error(t("تعذر عرض صفحة المستند."));
      renderTask = loadedPage.render({
        canvas,
        canvasContext: context,
        viewport: loadedPage.getViewport({ scale: scale * pixelRatio }),
      });
      return renderTask.promise;
    }).then(() => {
      if (active) setRendering(false);
    }).catch((caught: unknown) => {
      if (!active || (caught instanceof Error && caught.name === "RenderingCancelledException")) return;
      setRendering(false);
      setError(caught instanceof Error ? caught.message : t("تعذر عرض صفحة المستند."));
    });
    return () => {
      active = false;
      renderTask?.cancel();
      page?.cleanup();
    };
  }, [pdf, pageNumber, zoom, fitWidth, t]);

  const runAction = async (kind: "download" | "native") => {
    const action = kind === "download" ? onDownload : onNativeOpen;
    if (!action) return;
    setBusyAction(kind);
    setError("");
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("تعذر تنفيذ الإجراء."));
    } finally {
      setBusyAction(null);
    }
  };

  const retry = () => {
    setPdf(null);
    setLoading(true);
    setError("");
    // Changing the key triggers the loader effect while keeping the source URL untouched.
    setRetryKey((current) => current + 1);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") setPageNumber((current) => Math.min(pdf?.numPages ?? current, current + 1));
      if (event.key === "ArrowRight") setPageNumber((current) => Math.max(1, current - 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, pdf]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("معاينة المستند")}
      dir={language === "ar" ? "rtl" : "ltr"}
      style={{
        position: "fixed", inset: 0, zIndex: 2147483000, display: "flex", flexDirection: "column",
        background: colors.background, color: colors.ink, fontFamily: `${appFontFamily}, sans-serif`,
      }}
    >
      <style>{`
        .doc-preview-action { transition: transform 140ms ease, opacity 140ms ease; }
        .doc-preview-action:hover:not(:disabled) { transform: translateY(-1px); }
        .doc-preview-action:active:not(:disabled) { transform: translateY(0); }
        .doc-preview-action:focus-visible { outline: 3px solid ${colors.yellow}; outline-offset: 2px; }
        @media (max-width: 600px) {
          .doc-preview-title { max-width: 42vw !important; }
          .doc-preview-label { display: none !important; }
        }
      `}</style>
      <header style={{
        minHeight: 72, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 14,
        padding: "12px clamp(14px, 3vw, 30px)", background: colors.navy, color: colors.white,
        borderBottom: `4px solid ${colors.yellow}`, boxShadow: "0 8px 24px rgba(18, 45, 60, .18)",
      }}>
        <button className="doc-preview-action" type="button" aria-label={t("إغلاق")} onClick={onClose} style={iconButtonStyle}>
          <span aria-hidden="true" style={{ fontSize: 25, lineHeight: 1 }}>×</span>
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="doc-preview-title" title={file.title} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 17, fontWeight: 700 }}>
            {file.title}
          </div>
          <div style={{ fontSize: 12, color: colors.lightBlue, marginTop: 2 }}>
            {t("ينتهي في")} {formatDateTime(file.expiresAt, language)}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="doc-preview-action" type="button" aria-label={t("تنزيل")} onClick={() => void runAction("download")} disabled={!!busyAction} style={actionButtonStyle}>
            <span aria-hidden="true">↓</span><span className="doc-preview-label">{t("تنزيل")}</span>
          </button>
          {onNativeOpen ? <button className="doc-preview-action" type="button" aria-label={t("طباعة أو فتح")} onClick={() => void runAction("native")} disabled={!!busyAction} style={secondaryButtonStyle}>
            <span aria-hidden="true">▣</span><span className="doc-preview-label">{t("طباعة أو فتح")}</span>
          </button> : null}
        </div>
      </header>

      <main style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: colors.deepBlue }}>
        <nav aria-label={t("أدوات المستند")} style={{
          minHeight: 56, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          flexWrap: "wrap", padding: "8px 14px", background: colors.surface, borderBottom: `1px solid ${colors.border}`,
        }}>
          <button className="doc-preview-action" type="button" aria-label={t("الصفحة السابقة")} disabled={loading || !!error || pageNumber <= 1}
            onClick={() => setPageNumber((current) => Math.max(1, current - 1))} style={toolButtonStyle}>‹</button>
          <span aria-live="polite" style={{ minWidth: 92, textAlign: "center", fontSize: 13, fontWeight: 700 }}>
            {pdf ? `${t("صفحة")} ${pageNumber} ${t("من")} ${pdf.numPages}` : t(loading ? "جارٍ تحميل المستند..." : "المستند")}
          </span>
          <button className="doc-preview-action" type="button" aria-label={t("الصفحة التالية")} disabled={loading || !!error || !pdf || pageNumber >= pdf.numPages}
            onClick={() => setPageNumber((current) => Math.min(pdf?.numPages ?? current, current + 1))} style={toolButtonStyle}>›</button>
          <span aria-hidden="true" style={{ width: 1, height: 26, background: colors.border, margin: "0 5px" }} />
          <button className="doc-preview-action" type="button" aria-label={t("تصغير")} disabled={!!error} onClick={() => setZoom((current) => Math.max(0.5, Math.round((current - 0.15) * 100) / 100))} style={toolButtonStyle}>−</button>
          <span style={{ minWidth: 48, textAlign: "center", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>{Math.round(zoom * 100)}%</span>
          <button className="doc-preview-action" type="button" aria-label={t("تكبير")} disabled={!!error} onClick={() => setZoom((current) => Math.min(2.5, Math.round((current + 0.15) * 100) / 100))} style={toolButtonStyle}>+</button>
          <button className="doc-preview-action" type="button" onClick={() => setZoom(1)} disabled={!!error} style={{ ...toolButtonStyle, paddingInline: 12, fontSize: 12 }}>
            {t("ملاءمة العرض")}
          </button>
        </nav>
        <div ref={pageAreaRef} style={{ position: "relative", flex: 1, minHeight: 0, overflow: "auto", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 20, boxSizing: "border-box" }}>
          {loading ? <div role="status" style={{ width: "min(720px, 92%)", minHeight: 420, background: colors.surface, borderRadius: 5, padding: 28, boxSizing: "border-box", boxShadow: "0 16px 50px rgba(10, 30, 42, .22)" }}>
            <div style={{ height: 18, width: "42%", background: colors.blueSoft, borderRadius: 6, marginBottom: 24 }} />
            {[92, 84, 96, 71, 89, 65, 94, 78].map((width, index) => <div key={index} style={{ height: 10, width: `${width}%`, background: colors.blueSoft, borderRadius: 5, marginBottom: 16, opacity: 1 - index * 0.06 }} />)}
          </div> : error ? <div role="alert" style={{ alignSelf: "center", width: "min(460px, 92%)", padding: 28, textAlign: "center", background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 14, boxShadow: "0 18px 50px rgba(10, 30, 42, .22)" }}>
            <div style={{ width: 46, height: 46, margin: "0 auto 14px", borderRadius: "50%", display: "grid", placeItems: "center", background: colors.redSoft, color: colors.red, fontWeight: 800, fontSize: 22 }}>!</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{t("تعذر عرض المستند")}</div>
            <div style={{ fontSize: 13, color: colors.muted, overflowWrap: "anywhere", marginBottom: 18 }}>{error}</div>
            <button className="doc-preview-action" type="button" onClick={retry} style={primaryButtonStyle}>{t("إعادة المحاولة")}</button>
          </div> : <div style={{ position: "relative", flex: "0 0 auto", minHeight: "100%", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
            <canvas ref={canvasRef} aria-label={`${t("صفحة")} ${pageNumber}`} style={{ display: "block", maxWidth: "none", background: colors.surface, boxShadow: "0 16px 50px rgba(10, 30, 42, .28)" }} />
            {rendering ? <div role="status" aria-label={t("جارٍ عرض الصفحة")} style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "rgba(238,243,243,.16)" }} /> : null}
          </div>}
        </div>
      </main>
    </div>,
    document.body,
  );
}

const iconButtonStyle: CSSProperties = {
  width: 42, height: 42, flex: "0 0 auto", display: "grid", placeItems: "center", border: "1px solid rgba(255,255,255,.24)",
  borderRadius: 12, background: "rgba(255,255,255,.08)", color: colors.white, cursor: "pointer",
};
const actionButtonStyle: CSSProperties = {
  minHeight: 42, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "0 14px",
  border: "none", borderRadius: 10, background: colors.yellow, color: colors.onAccent, fontFamily: `${appFontFamily}, sans-serif`,
  fontSize: 13, fontWeight: 700, cursor: "pointer",
};
const secondaryButtonStyle: CSSProperties = {
  ...actionButtonStyle, background: "transparent", color: colors.white, border: "1px solid rgba(255,255,255,.32)",
};
const toolButtonStyle: CSSProperties = {
  minWidth: 38, minHeight: 38, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 8px",
  border: `1px solid ${colors.border}`, borderRadius: 9, background: colors.background, color: colors.navy,
  fontFamily: `${appFontFamily}, sans-serif`, fontSize: 20, fontWeight: 700, cursor: "pointer",
};
const primaryButtonStyle: CSSProperties = {
  minHeight: 44, border: "none", borderRadius: 10, padding: "0 20px", background: colors.action, color: colors.white,
  fontFamily: `${appFontFamily}, sans-serif`, fontSize: 14, fontWeight: 700, cursor: "pointer",
};
