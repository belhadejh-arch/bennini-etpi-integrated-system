import {parentPort,workerData} from "node:worker_threads";
import {tsImport} from "tsx/esm/api";
try{
  // Import ESM-only dependencies from a real file URL, not tsImport's CJS data URL.
  const pdf=await import("@react-pdf/renderer");
  const module=await tsImport("./report-pdf.ts",import.meta.url);
  const render=module.renderPortablePdf??module.default?.renderPortablePdf;
  const buffer=await render(workerData.report,workerData.options,pdf);
  const bytes=Uint8Array.from(buffer);
  parentPort.postMessage({ok:true,bytes},[bytes.buffer]);
}catch(error){
  // Do not send record content, HTML, secrets or private URLs into logs.
  parentPort.postMessage({ok:false,name:error?.name??"Error",code:error?.code??"PDF_LAYOUT_FAILED"});
}
