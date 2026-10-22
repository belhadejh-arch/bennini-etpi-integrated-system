import React from "react";
import path from "node:path";
import {readFileSync} from "node:fs";
import type {PrintReport,PrintOptions,PrintColumn,PrintTable} from "../shared/printing";
import {formatPrintCell} from "./print-html";

const h=React.createElement;
const font=path.resolve("app/assets/fonts/ChangaPrint-Regular.ttf");
const boldFont=path.resolve("app/assets/fonts/ChangaPrint-Bold.ttf");
const logo=readFileSync(path.resolve("app/assets/brand-mark-cropped.png"));
const styles={
  page:{fontFamily:"Changa",fontSize:9,color:"#142C45",paddingTop:174,paddingBottom:64,paddingHorizontal:30},
  brand:{position:"absolute",top:22,left:30,right:30,height:55,backgroundColor:"#12377B",padding:8,
    flexDirection:"row-reverse",alignItems:"center",justifyContent:"space-between"},
  logo:{width:48,height:38,objectFit:"contain"},
  brandText:{color:"#FFFFFF",fontSize:14,textAlign:"right"},
  title:{position:"absolute",top:85,left:30,right:30,fontSize:12,textAlign:"right"},
  subtitle:{position:"absolute",top:108,left:30,right:30,fontSize:8,textAlign:"right",color:"#526477"},
  heading:{position:"absolute",top:131,left:30,right:30,backgroundColor:"#E7EEF9",flexDirection:"row-reverse"},
  row:{flexDirection:"row-reverse",borderBottomWidth:0.5,borderBottomColor:"#CFD9E6"},
  cell:{paddingVertical:4,paddingHorizontal:5,borderLeftWidth:0.4,borderLeftColor:"#D7DFE9",textAlign:"right"},
  total:{marginTop:12,padding:8,backgroundColor:"#EEF3FA",textAlign:"right",fontSize:9},
  footer:{position:"absolute",bottom:20,left:30,right:30,fontSize:7,color:"#526477",textAlign:"right"},
} as const;
const bidi=(value:string)=>/[\u0600-\u06ff]/.test(value)?`\u200f${value}\u200f`:`\u200e${value}\u200e`;

/** Bounded cells allow every row to paginate without clipping a very long note. */
export function splitPdfCell(value:string,max=140):string[]{
  const characters=Array.from(value);
  const parts:string[]=[];
  while(characters.length){
    let end=Math.min(max,characters.length);
    if(end<characters.length){
      const space=characters.slice(0,end).lastIndexOf(" ");
      if(space>max/2)end=space+1;
    }
    parts.push(characters.splice(0,end).join(""));
  }
  return parts.length?parts:[""];
}
export function pdfColumnBands(columns:PrintColumn[],landscape:boolean):PrintColumn[][]{
  const max=landscape?8:6;
  if(columns.length<=max)return[columns];
  const identity=columns.find(c=>c.key==="id");
  const others=columns.filter(c=>c!==identity);
  const bands:PrintColumn[][]=[];
  for(let i=0;i<others.length;i+=max-(identity?1:0))
    bands.push([...(identity?[identity]:[]),...others.slice(i,i+max-(identity?1:0))]);
  return bands;
}
export async function renderPortablePdf(report:PrintReport,options:PrintOptions,
  renderer:typeof import("@react-pdf/renderer")):Promise<Buffer>{
  const {Document,Page,View,Text,Image,Font,renderToBuffer}=renderer;
  Font.register({family:"Changa",fonts:[{src:font,fontWeight:400},{src:boldFont,fontWeight:700}]});
  Font.registerHyphenationCallback((word)=>[word]);
  const title=report.key==="finance"&&report.rows.length===1
    ?(report.rows[0].type==="income"?"وصل قبض":"وصل دفع"):report.title;
  const tables:PrintTable[]=[];
  if(report.rows.length===1){
    tables.push({title:`تفاصيل السجل ${report.rows[0].id}`,
      columns:[{key:"field",label:"البيان"},{key:"value",label:"القيمة"}],
      rows:report.columns.map(column=>({field:column.label,value:formatPrintCell(report.rows[0],column)}))});
  }else tables.push({title:report.title,columns:report.columns,rows:report.rows});
  for(const row of report.rows)for(const detail of row._details??[])
    tables.push({...detail,title:`السجل ${row.id} — ${detail.title}`});
  if(report.key==="finance"){
    const income=report.rows.filter(row=>row.type==="income").reduce((sum,row)=>sum+Number(row.amount??0),0);
    const outgoing=report.rows.filter(row=>row.type==="expense").reduce((sum,row)=>sum+Number(row.amount??0),0);
    tables.push({title:"الملخص المالي",columns:[{key:"label",label:"البيان"},{key:"value",label:"المبلغ (دج)",numeric:true}],
      rows:[{label:"الدخل",value:income},{label:"الخرج",value:outgoing},{label:"الصافي",value:income-outgoing}]});
  }
  const pages:React.ReactElement[]=[];
  for(const table of tables){
    for(const [bandIndex,columns] of pdfColumnBands(table.columns,options.landscape).entries()){
      const width=`${100/Math.max(1,columns.length)}%` as const;
      const rows:React.ReactElement[]=[];
      table.rows.forEach((row,index)=>{
        const values=columns.map(column=>splitPdfCell(formatPrintCell(row,column)));
        const count=Math.max(1,...values.map(value=>value.length));
        for(let segment=0;segment<count;segment++){
          rows.push(h(View,{key:`${index}-${segment}`,wrap:false,style:[styles.row,
            {backgroundColor:index%2?"#F6F8FC":"#FFFFFF"}]},
            ...columns.map((column,j)=>h(Text,{key:column.key,style:[styles.cell,{width}]},
              bidi(values[j][segment]??(column.key==="id"?values[j][0]:""))))));
        }
      });
      const sums=bandIndex===0?table.columns.filter(c=>c.sum).map(column=>
        `${column.label}: ${formatPrintCell({value:table.rows.reduce((sum,row)=>sum+Number(row[column.key]??0),0)},
          {key:"value",label:"",numeric:true})}`):[];
      pages.push(h(Page,{key:`${pages.length}`,size:options.paper==="Letter"?"LETTER":options.paper,orientation:options.landscape?"landscape":"portrait",style:styles.page,wrap:true},
        h(View,{fixed:true,style:styles.brand},
          h(Image,{src:{data:logo,format:"png"},style:styles.logo}),
          h(Text,{style:styles.brandText},"BENNINI ETPI")),
        h(Text,{fixed:true,style:styles.title},bidi(title)),
        h(Text,{fixed:true,style:styles.subtitle},bidi(`${table.title}${bandIndex?` · مجموعة الأعمدة ${bandIndex+1}`:""}`)),
        h(View,{fixed:true,style:styles.heading},...columns.map(column=>
          h(Text,{key:column.key,style:[styles.cell,{width,fontWeight:700}]},bidi(column.label)))),
        ...(rows.length?rows:[h(Text,{key:"empty",style:{textAlign:"right"}},"لا توجد بيانات")]),
        ...sums.map((sum,i)=>h(Text,{key:`total-${i}`,style:styles.total,wrap:false},bidi(sum))),
        h(Text,{fixed:true,style:styles.footer,render:({pageNumber,totalPages})=>
          bidi(`${report.generatedBy} · ${report.generatedAt} · ${pageNumber} / ${totalPages}`)}),
      ));
    }
  }
  return renderToBuffer(h(Document,{title,author:"BENNINI ETPI",language:"ar"},...pages));
}
