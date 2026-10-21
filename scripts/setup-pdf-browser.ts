import {install} from "@puppeteer/browsers";
import {findPdfBrowser,pdfBrowserOptions} from "../server/pdf-browser";

async function main(){
  if(findPdfBrowser()){console.log("PDF browser is available.");return;}
  await install(pdfBrowserOptions);
  console.log("PDF browser installed for the configured Puppeteer version.");
}
main().catch(()=>{console.error("PDF browser setup failed. Check build network access and supported Chrome libraries.");process.exitCode=1;});
