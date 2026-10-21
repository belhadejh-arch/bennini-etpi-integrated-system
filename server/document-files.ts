import {createHash,randomBytes} from "node:crypto";
import {setInterval} from "node:timers";
import type pg from "pg";
import type {Express,RequestHandler} from "express";
import type {Member,AuthenticatedRequest} from "./index";
import {FinanceError} from "./finance-data";
import {hasPermission} from "../shared/access";
import type {SectionId} from "../shared/sections";

const MAX_BYTES=25*1024*1024;
const TOKEN_TTL_MS=5*60*1000;
const initialized=new WeakMap<pg.Pool,Promise<void>>();
function initialize(pool:pg.Pool){
  let promise=initialized.get(pool);
  if(!promise){
    promise=pool.query(`CREATE TABLE IF NOT EXISTS document_previews(
      token_hash TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES members(clerk_user_id) ON DELETE CASCADE,
      permission_hash TEXT NOT NULL,file_name TEXT NOT NULL,mime_type TEXT NOT NULL,
      file_data BYTEA NOT NULL,expires_at TIMESTAMPTZ NOT NULL);
      CREATE INDEX IF NOT EXISTS document_previews_expiry_idx ON document_previews(expires_at);`).then(()=>{});
    initialized.set(pool,promise);
    promise.catch(()=>{initialized.delete(pool)});
  }
  return promise;
}
const hash=(input:string)=>createHash("sha256").update(input).digest("hex");
function stable(value:unknown):unknown{
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==="object")return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,stable((value as Record<string,unknown>)[key])]));
  return value;
}
export function documentPermissions(member:Member){
  const capabilities={
    uploadFiles:member.capabilities?.uploadFiles!==false,
    viewFinancialData:member.capabilities?.viewFinancialData!==false,
    manageOperations:member.capabilities?.manageOperations!==false,
  };
  return hash(JSON.stringify(stable([member.role,member.active,[...member.allowed_sections].sort(),
    member.permissions??{},capabilities])));
}
export async function createDocumentFile(pool:pg.Pool,member:Member,data:Buffer,fileName:string,mimeType="application/pdf"){
  if(data.length>MAX_BYTES)throw new FinanceError(413,"حجم المستند أكبر من الحد المسموح للمعاينة.");
  await initialize(pool);
  const token=randomBytes(32).toString("hex");
  const expiresAt=new Date(Date.now()+TOKEN_TTL_MS).toISOString();
  await pool.query("DELETE FROM document_previews WHERE expires_at<=NOW()");
  await pool.query(`DELETE FROM document_previews WHERE owner_id=$1 AND token_hash IN(
    SELECT token_hash FROM document_previews WHERE owner_id=$1 ORDER BY expires_at DESC OFFSET 4)`,[member.clerk_user_id]);
  await pool.query(`INSERT INTO document_previews(token_hash,owner_id,permission_hash,file_name,mime_type,file_data,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7)`,[hash(token),member.clerk_user_id,documentPermissions(member),fileName,mimeType,data,expiresAt]);
  return {url:`/api/document-files/${token}`,title:fileName,expiresAt};
}

/** Strict route whitelist: never fetch an arbitrary client-supplied URL on the server. */
export async function attachmentDocument(pool:pg.Pool,member:Member,url:string){
  const targets=[
    {pattern:/^\/api\/transaction-attachments\/(\d+)$/,section:"finance",sql:`SELECT a.*,p.account_id,f.member_id FROM transaction_attachments a
      JOIN transactions p ON p.id=a.transaction_id LEFT JOIN finance_accounts f ON f.id=p.account_id WHERE a.id=$1`},
    {pattern:/^\/api\/inventory-attachments\/(\d+)$/,section:"inventory",sql:"SELECT * FROM inventory_attachments WHERE id=$1"},
    {pattern:/^\/api\/cheque-attachments\/(\d+)$/,section:"cheques",sql:"SELECT * FROM cheque_attachments WHERE id=$1"},
    {pattern:/^\/api\/rental-attachments\/(\d+)$/,section:"rentals",sql:"SELECT * FROM rental_attachments WHERE id=$1"},
    {pattern:/^\/api\/field-expense-attachments\/(\d+)$/,section:"field",sql:`SELECT a.*,p.created_by_id FROM field_expense_attachments a
      JOIN field_expenses p ON p.id=a.field_expense_id WHERE a.id=$1`},
    {pattern:/^\/api\/machinery\/spare-part-attachments\/(\d+)$/,section:"machinery",sql:"SELECT * FROM machinery_spare_part_attachments WHERE id=$1"},
    {pattern:/^\/api\/machinery\/related-attachments\/rental\/(\d+)\?machineryId=(\d+)$/,section:"machinery",
      sql:"SELECT a.* FROM rental_attachments a JOIN rentals p ON p.id=a.rental_id WHERE a.id=$1 AND p.machinery_id=$2"},
    {pattern:/^\/api\/machinery\/related-attachments\/field\/(\d+)\?machineryId=(\d+)$/,section:"machinery",
      sql:"SELECT a.* FROM field_expense_attachments a JOIN field_expenses p ON p.id=a.field_expense_id WHERE a.id=$1 AND p.machinery_id=$2"},
  ];
  const target=targets.find((item)=>item.pattern.test(url));
  if(!target)throw new FinanceError(400,"مسار المرفق غير صالح.");
  if(!hasPermission(member,target.section as SectionId,"view")||member.role==="partner"&&target.section!=="finance")
    throw new FinanceError(403,"لا تملك صلاحية الوصول إلى هذا القسم.");
  const parameters=target.pattern.exec(url)!.slice(1);
  const attachment=(await pool.query(target.sql,parameters)).rows[0];
  if(!attachment||target.section==="finance"&&member.role==="partner"&&attachment.member_id!==member.clerk_user_id||
    target.section==="field"&&!["admin","finance"].includes(member.role)&&attachment.created_by_id!==member.clerk_user_id)
    throw new FinanceError(404,"المرفق غير موجود.");
  return createDocumentFile(pool,member,Buffer.from(attachment.file_data),attachment.file_name,attachment.mime_type);
}
export function registerDocumentFiles(app:Express,pool:pg.Pool,authenticate:RequestHandler){
  app.post("/api/attachment-document",authenticate,async(req:AuthenticatedRequest,res)=>{
    try{
      if(typeof req.body?.url!=="string")throw new FinanceError(400,"مسار المرفق غير صالح.");
      res.setHeader("Cache-Control","no-store");
      res.json(await attachmentDocument(pool,req.member!,req.body.url));
    }catch(error){documentError(res,error)}
  });
  // Scoped capability URL for Median's native downloader, which cannot send our Bearer header.
  app.get("/api/document-files/:token",async(req,res)=>{
    try{
      res.setHeader("Cache-Control","private, no-store, max-age=0");
      res.setHeader("Referrer-Policy","no-referrer");
      res.setHeader("X-Content-Type-Options","nosniff");
      res.setHeader("X-Robots-Tag","noindex, nofollow, noarchive");
      if(!/^[a-f0-9]{64}$/.test(String(req.params.token)))throw new FinanceError(404,"المستند غير متاح أو انتهت صلاحية الرابط.");
      await initialize(pool);
      const result=await pool.query(`SELECT d.*,m.role,m.active,m.allowed_sections,m.permissions,m.capabilities,m.deleted_at
        FROM document_previews d JOIN members m ON m.clerk_user_id=d.owner_id
        WHERE d.token_hash=$1 AND d.expires_at>NOW()`,[hash(String(req.params.token))]);
      const file=result.rows[0];
      if(!file||!file.active||file.deleted_at||file.permission_hash!==documentPermissions(file))
        throw new FinanceError(404,"المستند غير متاح أو انتهت صلاحية الرابط.");
      const safeName=encodeURIComponent(String(file.file_name).replace(/[\r\n"]/g,""));
      res.setHeader("Content-Type",file.mime_type);
      const inline=file.mime_type==="application/pdf"||/^image\/(png|jpeg|webp|gif)$/.test(file.mime_type);
      res.setHeader("Content-Disposition",`${req.query.download==="1"||!inline?"attachment":"inline"}; filename*=UTF-8''${safeName}`);
      res.send(Buffer.from(file.file_data));
    }catch(error){documentError(res,error)}
  });
  const cleanup=setInterval(()=>{void initialize(pool).then(()=>pool.query("DELETE FROM document_previews WHERE expires_at<=NOW()"))
    .catch(()=>{/* A failed sweep retries at the next interval; access always checks expiry. */});},60000) as unknown as NodeJS.Timeout;
  cleanup.unref();
}
export function documentError(res:import("express").Response,error:unknown){
  if(error instanceof FinanceError)return res.status(error.status).json({error:error.message});
  console.error("Document operation failed",error instanceof Error?error.name:"unknown");
  return res.status(500).json({error:"تعذر إعداد المستند. يرجى إعادة المحاولة."});
}
