import puppeteer from "puppeteer-core";
import {findPdfBrowser} from "./pdf-browser";
import type {PrintOptions} from "../shared/printing";
import {FinanceError} from "./finance-data";

let waiting=0;
let previous:Promise<void>=Promise.resolve();
/** One browser at a time; never let a burst of reports exhaust server memory. */
export async function renderPdf(html:string,options:PrintOptions):Promise<Buffer>{
  if(waiting>=8)throw new FinanceError(503,"خدمة PDF مشغولة حالياً. يرجى إعادة المحاولة.");
  waiting++;
  const before=previous;
  let release!:()=>void;
  previous=new Promise<void>((resolve)=>{release=resolve});
  await before;
  let browser;
  try{
    const executablePath=findPdfBrowser();
    if(!executablePath)throw new Error("PDF browser missing; run npm run setup:pdf-browser during build.");
    browser=await puppeteer.launch({executablePath,headless:true,timeout:25000,
      args:["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage","--disable-background-networking"]});
    const page=await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request",(request)=>{
      // Reports embed their logo/font. Deny all network access, including localhost.
      void (/^(data:|about:|blob:)/.test(request.url())?request.continue():request.abort());
    });
    await page.setContent(html,{waitUntil:"load",timeout:25000});
    await page.evaluate(async()=>{await document.fonts.ready});
    return Buffer.from(await page.pdf({format:options.paper,landscape:options.landscape,
      printBackground:true,preferCSSPageSize:true,timeout:30000}));
  }catch(error){
    if(error instanceof FinanceError)throw error;
    console.error("PDF rendering failed",error instanceof Error?error.name:"unknown");
    throw new FinanceError(503,"تعذر إنشاء ملف PDF. يرجى إعادة المحاولة.");
  }finally{
    try{await browser?.close();}finally{waiting--;release();}
  }
}
