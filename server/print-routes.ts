import type { Express, RequestHandler } from "express";
import type pg from "pg";
import type { AuthenticatedRequest } from "./index";
import { FinanceError, positiveId } from "./finance-data";
import { availablePrintReports, loadPrintReport, addPrintDetails, type NotificationPrintLoader } from "./print-data";
import { renderPrintHtml } from "./print-html";
import type { PrintOptions } from "../shared/printing";

export function registerPrintRoutes(app: Express, pool: pg.Pool, authenticate: RequestHandler,notifications?:NotificationPrintLoader) {
  app.get("/api/print-reports",authenticate,(req:AuthenticatedRequest,res) => {
    res.json({items:availablePrintReports(req.member!)});
  });
  app.get("/api/print-data/:report",authenticate,async(req:AuthenticatedRequest,res) => {
    try {
      res.json(await loadPrintReport(pool,req.member!,String(req.params.report),positiveId(req.query.accountId) ?? undefined,notifications));
    } catch(error) { fail(res,error); }
  });
  app.post("/api/print-preview/:report",authenticate,async(req:AuthenticatedRequest,res) => {
    try {
      const {paper="A4",landscape=false,ids,accountId} = req.body ?? {};
      if (!["A4","A3","Letter"].includes(paper) || typeof landscape!=="boolean" ||
          (ids!==undefined && (!Array.isArray(ids) || !ids.length || ids.length>100000 || ids.some((id:unknown) => typeof id!=="string" || id.length>100)))) {
        throw new FinanceError(400,"إعدادات الطباعة غير صالحة.");
      }
      const report=await loadPrintReport(pool,req.member!,String(req.params.report),positiveId(accountId) ?? undefined,notifications);
      if(ids) {
        const selected=new Set(ids);
        report.rows=report.rows.filter((row) => selected.has(String(row.id)));
        if(report.rows.length!==selected.size) throw new FinanceError(404,"بعض السجلات المحددة غير موجودة أو غير متاحة لك.");
      }
      await addPrintDetails(pool,report,req.member!);
      res.json({html:renderPrintHtml(report,{paper,landscape,ids} as PrintOptions),count:report.rows.length});
    }catch(error){ fail(res,error); }
  });
}
function fail(res: import("express").Response,error:unknown) {
  if(error instanceof FinanceError) return res.status(error.status).json({error:error.message});
  console.error("Print report failed:",error);
  return res.status(500).json({error:"تعذر إعداد مستند الطباعة. يرجى إعادة المحاولة."});
}
