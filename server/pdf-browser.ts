import {execFileSync} from "node:child_process";
import {existsSync} from "node:fs";
import path from "node:path";
import {Browser,computeExecutablePath} from "@puppeteer/browsers";
import {PUPPETEER_REVISIONS} from "puppeteer-core/internal/revisions.js";

export const pdfBrowserOptions={
  browser:Browser.CHROME,
  buildId:PUPPETEER_REVISIONS.chrome,
  cacheDir:path.resolve("generated-artifacts/pdf-browser"),
};

export function findPdfBrowser():string|undefined{
  for(const binary of ["chromium","chromium-browser","google-chrome"]){
    try{return execFileSync("which",[binary],{encoding:"utf8",stdio:["ignore","pipe","ignore"]}).trim();}
    catch{/* Non-Nix hosts use the browser downloaded during build. */}
  }
  const managed=computeExecutablePath(pdfBrowserOptions);
  return existsSync(managed)?managed:undefined;
}
