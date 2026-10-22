import{test}from"node:test";
import{strict as assert}from"node:assert";
import{execFile}from"node:child_process";
import{promisify}from"node:util";
import{writeFileSync}from"node:fs";
import{renderPdf}from"../pdf-renderer";
import{pdfColumnBands,splitPdfCell}from"../report-pdf";
import type{PrintReport}from"../../shared/printing";

const report:PrintReport={key:"rentals",title:"اختبار الكراء",generatedBy:"Test",generatedAt:"2026-10-22",
  columns:[{key:"id",label:"الرقم"},{key:"value",label:"القيمة",numeric:true}],rows:[{id:1,value:1.75}]};
test("PDF generation really works when no Chrome or shell executable is on PATH",async()=>{
  const {stdout}=await promisify(execFile)(process.execPath,["--import","tsx","-e",
    `const {renderPdf}=require("./server/pdf-renderer.ts");renderPdf(${JSON.stringify(report)},
    {paper:"A4",landscape:false}).then(b=>{if(b.subarray(0,5).toString()!=="%PDF-")process.exit(2);console.log("PDF_WITHOUT_BROWSER "+b.length)}).catch(()=>process.exit(3));`],
    {cwd:process.cwd(),env:{...process.env,PATH:"/no-browser-executables"},timeout:60000});
  assert.match(stdout,/PDF_WITHOUT_BROWSER [1-9][0-9]+/);
});
test("wide reports preserve all columns and long Unicode values without truncation",async()=>{
  const columns=Array.from({length:15},(_,i)=>({key:i?`col${i}`:"id",label:`COLUMN_${i}`}));
  const bands=pdfColumnBands(columns,true);
  assert.deepEqual([...new Set(bands.flat().map(c=>c.key))].sort(),columns.map(c=>c.key).sort());
  const long="ملاحظة طويلة مع جميع التفاصيل ".repeat(120)+"END_OF_NOTE";
  assert.equal(splitPdfCell(long).join(""),long);
  const wide:PrintReport={...report,columns,rows:Array.from({length:137},(_,i)=>Object.fromEntries(
    columns.map((column,j)=>[column.key,j?`VALUE_${i+1}_${j}`:i+1]))) as PrintReport["rows"]};
  wide.rows[0].col14=long;
  const bytes=await renderPdf(wide,{paper:"A4",landscape:true});
  assert.equal(bytes.subarray(0,5).toString(),"%PDF-");
  assert.ok(bytes.subarray(-40).toString().includes("%%EOF"));
  assert.ok((bytes.toString("latin1").match(/\/Type \/Page\b/g)??[]).length>2,"Real multiple-page PDF");
  writeFileSync("/tmp/pdf-portable-wide.pdf",bytes);
});
test("paper formats and bounded concurrent PDF jobs complete without exhausting the server",async()=>{
  const jobs=["A4","A3","Letter"].map(paper=>renderPdf(report,
    {paper:paper as "A4"|"A3"|"Letter",landscape:paper==="A3"}));
  await assert.rejects(renderPdf(report,{paper:"A4",landscape:false}),/خدمة PDF مشغولة/);
  for(const bytes of await Promise.all(jobs))assert.equal(bytes.subarray(0,5).toString(),"%PDF-");
});
