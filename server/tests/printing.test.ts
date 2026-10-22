import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {test} from "node:test";
import express from "express";
import pg from "pg";
import {availablePrintReports,loadPrintReport,addPrintDetails} from "../print-data";
import {renderPrintHtml} from "../print-html";
import {registerPrintRoutes} from "../print-routes";
import {registerDocumentFiles,createDocumentFile,attachmentDocument} from "../document-files";
import type {Member,AuthenticatedRequest} from "../index";
import type {PrintReport} from "../../shared/printing";

const member=(role:string,id="a"):Member=>({
  clerk_user_id:id,name:"اختبار",email:null,role,active:true,allowed_sections:[],
});
test("report catalog respects permissions and partner-only ownership rules",()=>{
  assert.ok(availablePrintReports(member("admin")).some((entry)=>entry.key==="users"));
  assert.deepEqual(availablePrintReports(member("partner")).map((entry)=>entry.key),["dashboard","finance","partners","notifications","profile"]);
  assert.deepEqual(availablePrintReports(member("field")).map((entry)=>entry.key),["dashboard","notifications","profile"]);
});
test("HTML is self-contained, escaped, RTL, paginated and never drops wide columns or tail rows",()=>{
  const report:PrintReport={key:"inventory",title:"<script>bad()</script>",generatedAt:"2026",generatedBy:"<img onerror=x>",
    columns:Array.from({length:15},(_,i)=>({key:i===0?"id":`col${i}`,label:`column-${i}`})),
    rows:Array.from({length:137},(_,i)=>Object.fromEntries([["id",i+1],...Array.from({length:14},(_,j)=>[`col${j+1}`,`value-${i+1}-${j+1}`])])) as PrintReport["rows"]};
  const html=renderPrintHtml(report,{paper:"A4",landscape:true},{font:"Zm9udA==",logo:"bG9nbw=="});
  assert.ok(html.includes('lang="ar" dir="rtl"'));
  assert.ok(html.includes("display:table-header-group"));
  assert.ok(html.includes("size:A4 landscape"));
  assert.ok(html.includes("@font-face"));
  assert.ok(html.includes("data:font/ttf;base64,"));
  assert.ok(html.includes("value-137-14"));
  for(let i=0;i<15;i++)assert.ok(html.includes(`column-${i}`));
  assert.ok(!html.includes("<script>bad"));
  assert.ok(!html.includes("<img onerror=x>"));
  assert.ok(!html.includes("overflow:hidden"));
});
test("all report SQL, selection, receipts, invoices and shifts work on isolated real PostgreSQL",{
  skip:!(process.env.NEON_DATABASE_URL??process.env.DATABASE_URL),
},async(t)=>{
  const schema=`test_print_${randomUUID().replaceAll("-","")}`;
  const pool=new pg.Pool({connectionString:process.env.NEON_DATABASE_URL??process.env.DATABASE_URL,max:1,
    onConnect:async(client)=>{await client.query(`SET search_path TO ${schema},public`)}});
  let listener:ReturnType<ReturnType<typeof express>["listen"]>|undefined;
  try{
    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query(readFileSync("server/schema.sql","utf8"));
    await pool.query(readFileSync("server/finance-schema.sql","utf8"));
    await pool.query("INSERT INTO members(clerk_user_id,name,role,active) VALUES ('a','Admin','admin',true),('p','Partner','partner',true),('f','Field','field',true)");
    await pool.query(`INSERT INTO machinery(code,name) VALUES ('P','machine')`);
    await pool.query(`INSERT INTO finance_accounts(kind,name,member_id,created_by_id,created_by_name)
      VALUES ('partner','Own partner','p','a','Admin'),('partner','Other partner',NULL,'a','Admin'),('customer','Customer',NULL,'a','Admin')`);
    await pool.query(`INSERT INTO transactions(type,amount,party,recorded_by_id,recorded_by_name,account_id)
      VALUES ('income',200,'own','a','Admin',1),('expense',50,'other','a','Admin',2)`);
    await pool.query(`INSERT INTO customer_invoices(customer_id,invoice_number,normalized_invoice_number,invoice_date,created_by_id,created_by_name)
      VALUES (3,'C-1','c-1',CURRENT_DATE,'a','Admin')`);
    await pool.query(`INSERT INTO inventory_items(name,quantity,remaining_quantity,buy_price,total_cost,supplier,invoice_number,customer_id,customer_invoice_id)
      SELECT 'item-'||n,2,2,10,20,'supplier','',3,1 FROM generate_series(1,137)n`);
    await pool.query(`INSERT INTO rentals(machinery_id,equipment,client_or_owner,start_date,end_date,total_amount,rate_period,rental_rate,daily_shifts)
      VALUES(1,'machine','renter','2026-10-01','2026-10-03',350,'shift',100,'[{"date":"2026-10-01","shifts":1.5}]')`);
    await pool.query(`INSERT INTO field_expenses(category,amount,site_name,created_by_id,created_by_name)
      VALUES('own',10,'site','f','Field'),('other',20,'site','a','Admin')`);
    await t.test("every catalog report runs without truncation or schema errors",async()=>{
      for(const {key} of availablePrintReports(member("admin"))){
        const report=await loadPrintReport(pool,member("admin"),key);
        await addPrintDetails(pool,report,member("admin"));
        const html=renderPrintHtml(report,{paper:"A4",landscape:false});
        assert.ok(html.includes("<html"));
        if(key==="inventory") assert.equal(report.rows.length,137);
        if(key==="customerInvoices"){
          assert.equal(report.rows[0]._details?.[0].rows.length,137);
          assert.equal(Number(report.rows[0].amount),2740);
        }
      }
    });
    await t.test("rental details include default daily shifts, overrides and amounts",async()=>{
      const report=await addPrintDetails(pool,await loadPrintReport(pool,member("admin"),"rentals"),member("admin"));
      const days=report.rows[0]._details![0].rows;
      assert.equal(days.length,3);
      assert.equal(days[0].shifts,1.5);
      assert.equal(days[1].shifts,1);
      assert.equal(days.reduce((sum,row)=>sum+Number(row.amount),0),350);
    });
    await t.test("partners cannot print another account and field staff only get their own costs",async()=>{
      assert.equal((await loadPrintReport(pool,member("partner","p"),"finance")).rows.length,1);
      assert.equal((await loadPrintReport(pool,member("partner","p"),"partners",2)).rows.length,0);
      await assert.rejects(loadPrintReport(pool,member("partner","p"),"users"));
      const field=member("field","f");field.allowed_sections=["field"];
      const report=await loadPrintReport(pool,field,"field");
      assert.equal(report.rows.length,1);
      assert.equal(report.rows[0].category,"own");
      field.capabilities={viewFinancialData:false};
      const masked=await loadPrintReport(pool,field,"field");
      assert.equal(masked.rows[0].amount,undefined);
      assert.ok(!masked.columns.some((column)=>column.key==="amount"));
    });
    await t.test("HTTP selection returns correct records, refuses missing IDs and validates paper settings",async()=>{
      const app=express();app.use(express.json());
      registerPrintRoutes(app,pool,(req,res,next)=>{(req as AuthenticatedRequest).member=member(req.header("x-role")??"admin",req.header("x-member")??"a");next()});
      registerDocumentFiles(app,pool,(req,res,next)=>{(req as AuthenticatedRequest).member=member(req.header("x-role")??"admin",req.header("x-member")??"a");next()});
      listener=app.listen(0,"127.0.0.1");await new Promise<void>((resolve)=>listener!.once("listening",resolve));
      const address=listener.address();assert.ok(address&&typeof address!=="string");
      const post=async(report:string,body:unknown,role="admin",id="a")=>fetch(`http://127.0.0.1:${address.port}/api/print-preview/${report}`,
        {method:"POST",headers:{"Content-Type":"application/json","x-role":role,"x-member":id},body:JSON.stringify(body)});
      const invoice=await post("customerInvoices",{ids:["1"]});
      assert.equal(invoice.status,200);assert.ok((await invoice.json()).html.includes("item-137"));
      const receipt=await post("finance",{ids:["1"]});
      assert.equal(receipt.status,200);assert.ok((await receipt.json()).html.includes("وصل قبض"));
      assert.equal((await post("finance",{ids:["2"]},"partner","p")).status,404);
      assert.equal((await post("inventory",{ids:["1","137"]})).status,200);
      assert.equal((await post("inventory",{ids:["9999"]})).status,404);
      assert.equal((await post("inventory",{paper:"<script>"})).status,400);
      assert.equal((await post("inventory",{ids:[]})).status,400);
      const actual=await fetch(`http://127.0.0.1:${address.port}/api/print-document/rentals`,{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids:["1"],includePrintHtml:true})});
      assert.equal(actual.status,200);
      const file=await actual.json();
      assert.equal(file.count,1);
      assert.ok(file.printHtml.includes('dir="rtl"'));
      assert.ok(file.printHtml.includes("2026-10-01"));
      assert.ok(/^\/api\/document-files\/[a-f0-9]{64}$/.test(file.url));
      const readFile=()=>fetch(`http://127.0.0.1:${address.port}${file.url}`);
      const pdf=await readFile();
      assert.equal(pdf.headers.get("Content-Type"),"application/pdf");
      assert.ok(pdf.headers.get("Cache-Control")?.includes("no-store"));
      assert.ok(pdf.headers.get("Content-Disposition")?.startsWith("inline"));
      const bytes=Buffer.from(await pdf.arrayBuffer());
      assert.equal(bytes.subarray(0,5).toString(),"%PDF-");
      assert.ok(bytes.length>10000);
      await pool.query("UPDATE members SET active=false WHERE clerk_user_id='a'");
      assert.equal((await readFile()).status,404,"deactivation immediately revokes a document URL");
      await pool.query("UPDATE members SET active=true,allowed_sections=ARRAY['finance'] WHERE clerk_user_id='a'");
      assert.equal((await readFile()).status,404,"permission changes revoke prior document URLs");
      await pool.query("UPDATE members SET allowed_sections=ARRAY[]::text[] WHERE clerk_user_id='a'");
      await pool.query("UPDATE document_previews SET expires_at=NOW()-INTERVAL '1 second'");
      assert.equal((await readFile()).status,404,"expired links do not reveal bytes");
      assert.equal((await fetch(`http://127.0.0.1:${address.port}/api/document-files/guess`)).status,404);
      await assert.rejects(attachmentDocument(pool,member("admin"),"https://evil.example/pdf"),/مسار/);
      const attachment=await pool.query(`INSERT INTO field_expense_attachments(field_expense_id,file_name,mime_type,file_size,file_data,uploaded_by_id,uploaded_by_name)
        VALUES(2,'private.pdf','application/pdf',5,$1,'a','Admin') RETURNING id`,[Buffer.from("%PDF-")]);
      await assert.rejects(attachmentDocument(pool,{...member("field","f"),allowed_sections:["field"]},
        `/api/field-expense-attachments/${attachment.rows[0].id}`),/المرفق/,"field staff cannot preview another member’s attachment");
      const original=await createDocumentFile(pool,member("admin"),Buffer.from("%PDF-"),"original.pdf");
      const stored=await pool.query("SELECT token_hash FROM document_previews WHERE file_name='original.pdf'");
      assert.ok(!original.url.includes(stored.rows[0].token_hash),"only a hash of the capability token is stored");
    });
  }finally{
    if(listener)await new Promise<void>((resolve)=>listener!.close(()=>resolve()));
    await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await pool.end();
  }
});
