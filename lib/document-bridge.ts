export type DocumentFile={url:string;title:string;expiresAt:string};
type FileBridge={share?:{downloadFile?:(options:{url:string;open:boolean})=>void|Promise<unknown>}};
type MedianWindow=Window & {median?:FileBridge;gonative?:FileBridge};
export function isMedianApp(){
  if(typeof window==="undefined")return false;
  const host=window as MedianWindow;
  return /median|gonative/i.test(navigator.userAgent)||!!host.median||!!host.gonative;
}
function absoluteDocumentUrl(file:DocumentFile){
  const url=new URL(file.url,window.location.origin);
  if(url.origin!==window.location.origin||!/^\/api\/document-files\/[a-f0-9]{64}$/.test(url.pathname))
    throw new Error("رابط المستند غير صالح.");
  if(Date.parse(file.expiresAt)<=Date.now())throw new Error("انتهت صلاحية المستند. أغلق المعاينة وأنشئه من جديد.");
  return url;
}
export async function openDeviceDocument(file:DocumentFile,download=false){
  const url=absoluteDocumentUrl(file);
  if(isMedianApp()){
    for(let i=0;i<15;i++){
      const host=window as MedianWindow;
      const bridge=host.median?.share?.downloadFile?host.median:host.gonative;
      if(bridge?.share?.downloadFile){
        // Median fetches natively: a Blob URL or an Authorization header would not work here.
        await bridge.share.downloadFile({url:url.href,open:!download});
        return;
      }
      await new Promise((resolve)=>setTimeout(resolve,100));
    }
    // Documented Median inline-PDF navigation fallback, no popup required.
    if(download)url.searchParams.set("download","1");
    window.location.assign(url.href);
    return;
  }
  if(download){
    url.searchParams.set("download","1");
    const link=document.createElement("a");link.href=url.href;link.download=file.title;
    link.referrerPolicy="no-referrer";document.body.appendChild(link);link.click();link.remove();return;
  }
  // Desktop/browser printing of the actual PDF; the app itself remains on its preview.
  const frame=document.createElement("iframe");
  frame.title="PDF print";frame.style.cssText="position:fixed;width:1px;height:1px;bottom:0;left:0;border:0";
  frame.referrerPolicy="no-referrer";
  await new Promise<void>((resolve,reject)=>{
    const cleanup=()=>{frame.remove();clearTimeout(timeout)};
    const timeout=setTimeout(()=>{cleanup();reject(new Error("تعذر فتح طباعة PDF. نزّل الملف وافتحه من عارض PDF على الجهاز."));},20000);
    frame.onerror=()=>{cleanup();reject(new Error("تعذر فتح ملف PDF للطباعة."))};
    frame.onload=()=>{
      setTimeout(()=>{
        try{frame.contentWindow?.focus();frame.contentWindow?.print();resolve();
          // Leave enough time for the system print dialog to consume the PDF.
          clearTimeout(timeout);setTimeout(()=>frame.remove(),60000);
        }catch{cleanup();reject(new Error("الطباعة المباشرة غير مدعومة هنا. نزّل PDF واطبعه من عارض الجهاز."))}
      },500);
    };
    frame.src=url.href;document.body.appendChild(frame);
  });
}
