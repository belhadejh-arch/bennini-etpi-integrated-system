type PdfJs=typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let loading:Promise<PdfJs>|undefined;
export function loadPdfJs():Promise<PdfJs>{
  if(!loading){
    loading=new Promise<PdfJs>((resolve,reject)=>{
      const host=window as Window&{benniniPdfJs?:PdfJs};
      if(host.benniniPdfJs){resolve(host.benniniPdfJs);return;}
      const script=document.createElement("script");
      script.type="module";script.src="/pdf-assets/viewer-loader.mjs";
      script.onload=()=>{
        if(host.benniniPdfJs)resolve(host.benniniPdfJs);
        else reject(new Error("تعذر تحميل عارض PDF."));
      };
      script.onerror=()=>reject(new Error("تعذر تحميل عارض PDF. تحقق من الاتصال ثم أعد المحاولة."));
      document.head.appendChild(script);
    }).catch((error)=>{loading=undefined;throw error});
  }
  return loading;
}
