import type {DocumentFile} from "./document-bridge";
import {absoluteDocumentUrl} from "./document-bridge";

type PrintWindow=Window&{
  AC24_INTERNAL_PRINT_BRIDGE_2026?:{print:()=>void};
  __AC24_INTERNAL_PRINT_INSTALLED_2026?:boolean;
};
let cleanupTimer:ReturnType<typeof setTimeout>|undefined;
export function hasAppCreatorPrintBridge(){
  if(typeof window==="undefined")return false;
  const host=window as PrintWindow;
  return typeof host.AC24_INTERNAL_PRINT_BRIDGE_2026?.print==="function"||
    host.__AC24_INTERNAL_PRINT_INSTALLED_2026===true;
}
export function clearAppCreatorPrint(){
  if(cleanupTimer)clearTimeout(cleanupTimer);
  cleanupTimer=undefined;
  if(typeof document==="undefined")return;
  document.getElementById("bennini-native-print")?.remove();
  document.getElementById("bennini-native-print-css")?.remove();
}
/** AppCreator's verified bridge prints the MAIN WebView, not a hidden iframe. */
export async function printInAppCreator(file:DocumentFile){
  clearAppCreatorPrint();
  const container=document.createElement("div");
  container.id="bennini-native-print";
  let css="";
  if(file.printHtml){
    const parsed=new DOMParser().parseFromString(file.printHtml,"text/html");
    css=Array.from(parsed.querySelectorAll("style")).map(style=>style.textContent??"").join("\n");
    container.innerHTML=parsed.body.innerHTML;
  }else{
    // Existing PDF attachments have no report HTML. Print every page, not just
    // the currently visible preview canvas.
    const {loadPdfJs}=await import("./pdfjs-loader.web");
    const library=await loadPdfJs();
    const {apiUrl}=await import("./api");
    library.GlobalWorkerOptions.workerSrc=apiUrl("/pdf-assets/pdf.worker.min.mjs");
    const pdf=await library.getDocument({url:absoluteDocumentUrl(file).href,isEvalSupported:false}).promise;
    try{
      for(let number=1;number<=pdf.numPages;number++){
        const page=await pdf.getPage(number);
        const view=page.getViewport({scale:1});
        if(number===1)css=`@page{size:${view.width}pt ${view.height}pt;margin:0}`;
        const viewport=page.getViewport({scale:1.2});
        const canvas=document.createElement("canvas");
        canvas.dir="ltr";canvas.style.setProperty("direction","ltr","important");
        canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        const context=canvas.getContext("2d");
        if(!context)throw new Error("تعذر عرض صفحة المستند.");
        context.direction="ltr";
        await page.render({canvas,canvasContext:context,viewport}).promise;
        const image=document.createElement("img");
        image.src=canvas.toDataURL("image/png");
        image.style.cssText=`display:block;width:${view.width}pt;height:${view.height}pt;break-after:page;page-break-after:always`;
        container.appendChild(image);canvas.width=0;canvas.height=0;page.cleanup();
      }
    }finally{await pdf.destroy();}
  }
  const style=document.createElement("style");
  style.id="bennini-native-print-css";
  style.textContent=`@media screen{#bennini-native-print{display:none!important}}
    @media print{${css}
    html,body{height:auto!important;overflow:visible!important}
    body>:not(#bennini-native-print){display:none!important}
    #bennini-native-print{display:block!important;position:static!important}
    #bennini-native-print img:last-child{break-after:auto!important;page-break-after:auto!important}}`;
  document.head.appendChild(style);document.body.appendChild(container);
  try{
    await Promise.all(Array.from(container.querySelectorAll("img")).map(image=>image.decode()));
    await document.fonts.ready;
    const host=window as PrintWindow;
    if(host.AC24_INTERNAL_PRINT_BRIDGE_2026)host.AC24_INTERNAL_PRINT_BRIDGE_2026.print();
    else if(host.__AC24_INTERNAL_PRINT_INSTALLED_2026)window.print();
    else throw new Error("الطباعة المباشرة غير مدعومة هنا. نزّل PDF واطبعه من عارض الجهاز.");
    window.addEventListener("afterprint",clearAppCreatorPrint,{once:true});
    // Native layout can occur after the bridge returns; retain its source.
    cleanupTimer=setTimeout(clearAppCreatorPrint,180000);
  }catch(error){clearAppCreatorPrint();throw error;}
}
