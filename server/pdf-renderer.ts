import path from "node:path";
import {Worker} from "node:worker_threads";
import type {PrintOptions,PrintReport} from "../shared/printing";
import {FinanceError} from "./finance-data";

type Ticket={resolve:(release:()=>void)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>};
let active=false;
const queue:Ticket[]=[];
function release(){
  const next=queue.shift();
  if(next){clearTimeout(next.timer);next.resolve(release);}
  else active=false;
}
function acquire():Promise<()=>void>{
  if(!active){active=true;return Promise.resolve(release);}
  if(queue.length>=2)return Promise.reject(new FinanceError(503,"خدمة PDF مشغولة حالياً. يرجى إعادة المحاولة."));
  return new Promise((resolve,reject)=>{
    const ticket:Ticket={resolve,reject,timer:setTimeout(()=>{
      const index=queue.indexOf(ticket);
      if(index>=0)queue.splice(index,1);
      reject(new FinanceError(503,"خدمة PDF مشغولة حالياً. يرجى إعادة المحاولة."));
    },15000)};
    queue.push(ticket);
  });
}
/** No system browser, remote renderer, writable browser cache or shell executable. */
export async function renderPdf(report:PrintReport,options:PrintOptions):Promise<Buffer>{
  const unlock=await acquire();
  let worker:Worker|undefined;
  try{
    return await new Promise<Buffer>((resolve,reject)=>{
      worker=new Worker(path.resolve("server/report-pdf-worker.mjs"),{
        workerData:{report,options},resourceLimits:{maxOldGenerationSizeMb:192}});
      let finished=false;
      const done=(error?:Error,bytes?:Buffer)=>{
        if(finished)return;
        finished=true;clearTimeout(timer);
        error?reject(error):resolve(bytes!);
      };
      const timer=setTimeout(()=>done(new Error("PDF_RENDER_TIMEOUT")),45000);
      worker.once("message",(message)=>{
        if(!message.ok)return done(new Error(`${message.code}:${message.name}`));
        const bytes=Buffer.from(message.bytes);
        if(bytes.length<100||bytes.subarray(0,5).toString()!=="%PDF-")return done(new Error("PDF_INVALID_OUTPUT"));
        done(undefined,bytes);
      });
      worker.once("error",(error)=>done(new Error(`PDF_WORKER_FAILED:${error instanceof Error?error.name:"Error"}`)));
      worker.once("exit",()=>{if(!finished)done(new Error("PDF_WORKER_EXITED"));});
    });
  }catch(error){
    console.error("PDF rendering failed",{code:error instanceof Error?error.message:"PDF_UNKNOWN_FAILURE"});
    throw new FinanceError(503,"تعذر إنشاء ملف PDF. يرجى إعادة المحاولة.");
  }finally{
    try{await worker?.terminate();}finally{unlock();}
  }
}
