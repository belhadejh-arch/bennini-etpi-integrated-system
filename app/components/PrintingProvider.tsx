import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Printer, X } from "lucide-react-native";
import { useAuth } from "../../lib/auth";
import { apiRequest } from "../../lib/api";
import { colors } from "../../lib/theme";
import { printLabels, type PrintOptions, type PrintReport } from "../../shared/printing";
import { outputPrintHtml } from "../../lib/printing";
import {openDeviceDocument,type DocumentFile} from "../../lib/document-bridge";
import DocumentPreview from "./DocumentPreview";
import { translate } from "../../lib/localization";
import RentalDatePicker from "./RentalDatePicker";

type PrintRequest = { report?:string; ids?:string[]; accountId?:number };
const PrintingContext=createContext<{openPrint:(request?:PrintRequest)=>void;openAttachment:(url:string,download:boolean)=>Promise<void>}>({
  openPrint:()=>{},openAttachment:async()=>{throw new Error("معاينة المستند غير متاحة.")},
});
export const usePrinting=()=>useContext(PrintingContext);
export function PrintRecordButton({report,id,accountId}:{report:string;id?:string|number;accountId?:number}) {
  const {openPrint}=usePrinting();
  return <Pressable accessibilityRole="button" accessibilityLabel="طباعة" onPress={()=>openPrint({report,ids:id===undefined ? undefined:[String(id)],accountId})}
    style={{minHeight:42,paddingHorizontal:12,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7,borderRadius:9,borderWidth:1,borderColor:colors.border}}>
    <Printer size={16} color={colors.blue}/><Text style={{color:colors.blue,fontSize:13,fontWeight:"700"}}>طباعة</Text>
  </Pressable>;
}
export function PrintingProvider({children}:{children:ReactNode}) {
  const {member,getToken,language}=useAuth();
  const [request,setRequest]=useState<PrintRequest|null>(null);
  const [catalog,setCatalog]=useState<{key:string;title:string}[]>([]);
  const [key,setKey]=useState("dashboard");
  const [report,setReport]=useState<PrintReport|null>(null);
  const [selected,setSelected]=useState<string[]>([]);
  const [scope,setScope]=useState<"all"|"selected">("all");
  const [search,setSearch]=useState("");
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [page,setPage]=useState(0);
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [paper,setPaper]=useState<PrintOptions["paper"]>("A4");
  const [landscape,setLandscape]=useState(false);
  const [documentFile,setDocumentFile]=useState<DocumentFile|null>(null);
  const t=(text:string)=>translate(text,language);
  const openPrint=(next:PrintRequest={})=>{
    setRequest(next);setKey(next.report??"dashboard");setSelected(next.ids??[]);
    setScope(next.ids?.length ? "selected":"all");setSearch("");setFrom("");setTo("");setPage(0);setError("");setReport(null);
  };
  useEffect(()=>{if(!member){setRequest(null);setReport(null);setSelected([]);setDocumentFile(null);}},[member]);
  const openAttachment=async(url:string,download:boolean)=>{
    const file=await apiRequest<DocumentFile>("/attachment-document",getToken,{method:"POST",body:JSON.stringify({url})});
    if(download)await openDeviceDocument(file,true);
    else setDocumentFile(file);
  };
  useEffect(()=>{
    if(!request||!member) return;
    let active=true;
    apiRequest<{items:{key:string;title:string}[]}>("/print-reports",getToken).then((data)=>{
      if(active){setCatalog(data.items);if(!data.items.some((entry)=>entry.key===key))setKey(data.items[0]?.key??"");}
    }).catch((caught)=>{if(active)setError(caught.message)});
    return()=>{active=false};
  },[request,member,getToken]);
  useEffect(()=>{
    if(!request||!key) return;
    let active=true;
    setLoading(true);setReport(null);setError("");
    apiRequest<PrintReport>(`/print-data/${key}${request.accountId?`?accountId=${request.accountId}`:""}`,getToken)
      .then((data)=>{if(active){setReport(data);setLandscape(data.columns.length>7);setPage(0)}})
      .catch((caught)=>{if(active)setError(caught.message)})
      .finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[request,key,getToken]);
  const filtered=useMemo(()=>report?.rows.filter((row)=>{
    const matchesSearch=!search||report.columns.some((column)=>String(row[column.key]??"").toLowerCase().includes(search.trim().toLowerCase()));
    const dateKey=report.columns.find((column)=>/^(date|start_date|purchase_date|invoice_date|created_at|issue_date|movement_date)$/.test(column.key))?.key;
    const date=dateKey?String(row[dateKey]??"").slice(0,10):"";
    return matchesSearch&&(!from||!date||date>=from)&&(!to||!date||date<=to);
  })??[],[report,search,from,to]);
  const filteredIds=useMemo(()=>new Set(filtered.map((row)=>String(row.id))),[filtered]);
  const validSelected=selected.filter((id)=>filteredIds.has(id));
  const hasFilter=!!(search.trim()||from||to);
  const count=scope==="selected"?validSelected.length:filtered.length;
  const preview=async(pdf:boolean)=>{
    try {
      setError("");
      setBusy(true);
      const ids=scope==="selected"?validSelected:hasFilter?filtered.map((row)=>String(row.id)):undefined;
      const options={method:"POST",body:JSON.stringify({paper,landscape,ids,accountId:request?.accountId})};
      if(Platform.OS==="web"){
        const file=await apiRequest<DocumentFile>(`/print-document/${key}`,getToken,options);
        setDocumentFile(file);
        if(pdf)await openDeviceDocument(file,true);
      }else{
        const result=await apiRequest<{html:string}>(`/print-preview/${key}`,getToken,options);
        await outputPrintHtml(result.html,{paper,landscape},pdf);
      }
    }catch(caught){setError(caught instanceof Error?caught.message:"تعذر إعداد مستند الطباعة.");}
    finally{setBusy(false);}
  };
  const chip=(label:string,active:boolean,onPress:()=>void)=><Pressable key={label} accessibilityRole="button" accessibilityState={{selected:active}} onPress={onPress}
    style={{minHeight:42,paddingHorizontal:12,paddingVertical:8,borderRadius:9,borderWidth:1,borderColor:active?colors.blue:colors.border,backgroundColor:active?colors.blueSoft:colors.surface,justifyContent:"center"}}>
    <Text style={{color:colors.ink,fontSize:13,fontWeight:active?"700":"500"}}>{t(label)}</Text></Pressable>;
  return <PrintingContext.Provider value={{openPrint,openAttachment}}>{children}
    <Modal visible={!!request&&!documentFile} animationType="slide" onRequestClose={()=>!busy&&setRequest(null)}>
      <View style={{flex:1,backgroundColor:colors.background,direction:language==="ar"?"rtl":"ltr"}}>
        <View style={{padding:16,flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <Text style={{fontSize:20,color:colors.navy,fontWeight:"800"}}>الطباعة والتقارير</Text>
          <Pressable accessibilityLabel="إغلاق" onPress={()=>!busy&&setRequest(null)} style={{padding:12}}><X color={colors.ink} size={22}/></Pressable>
        </View>
        <ScrollView contentContainerStyle={{width:"100%",maxWidth:1000,alignSelf:"center",padding:16,gap:14}} keyboardShouldPersistTaps="handled">
          <Text style={{color:colors.muted,fontSize:13}}>تُحمّل كل السجلات المتاحة حسب صلاحياتك، بما فيها الصفحات غير الظاهرة. اختر التقرير والنطاق ثم افتح المعاينة.</Text>
          <View style={{flexDirection:"row",flexWrap:"wrap",gap:7}}>
            {catalog.map((entry)=>chip(printLabels[entry.key]??entry.title,key===entry.key,()=>{setKey(entry.key);setSelected([]);setScope("all");setFrom("");setTo("");setSearch("");}))}
          </View>
          {error?<Text accessibilityRole="alert" style={{color:colors.red,fontSize:14}}>{error}</Text>:null}
          <View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>
            {chip("كل السجلات",scope==="all",()=>setScope("all"))}{chip("السجلات المحددة",scope==="selected",()=>setScope("selected"))}
            {(["A4","A3","Letter"] as const).map((value)=>chip(value,paper===value,()=>setPaper(value)))}
            {chip("عمودي",!landscape,()=>setLandscape(false))}{chip("أفقي",landscape,()=>setLandscape(true))}
          </View>
          <TextInput value={search} onChangeText={(value)=>{setSearch(value);setPage(0)}} accessibilityLabel="بحث في سجلات الطباعة" placeholder="بحث في سجلات الطباعة"
            style={{minHeight:46,padding:10,borderWidth:1,borderColor:colors.border,borderRadius:9,color:colors.ink}}/>
          <View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>
            <RentalDatePicker label="من تاريخ" value={from} onChange={(value)=>{setFrom(value);setPage(0)}}/>
            <RentalDatePicker label="إلى تاريخ" value={to} onChange={(value)=>{setTo(value);setPage(0)}}/>
            {from||to?chip("مسح التاريخ",false,()=>{setFrom("");setTo("");setPage(0)}):null}
          </View>
          <Text style={{color:colors.ink,fontSize:14}}>{t("عدد السجلات للطباعة")}: {count} / {report?.rows.length??0}</Text>
          {loading?<ActivityIndicator color={colors.blue}/>:filtered.slice(page*30,(page+1)*30).map((row)=>{
            const checked=selected.includes(String(row.id));
            const text=report!.columns.filter((column)=>column.key!=="id").slice(0,3).map((column)=>`${t(column.label)}: ${String(row[column.key]??"—")}`).join(" · ");
            return <Pressable key={String(row.id)} accessibilityRole="checkbox" accessibilityState={{checked}} onPress={()=>{
              setScope("selected");setSelected((current)=>checked?current.filter((id)=>id!==String(row.id)):[...current,String(row.id)]);
            }} style={{padding:12,minHeight:48,borderWidth:1,borderColor:checked?colors.blue:colors.border,borderRadius:10,backgroundColor:checked?colors.blueSoft:colors.surface,flexDirection:"row",gap:10,alignItems:"center"}}>
              <Text style={{color:colors.blue,fontSize:18}}>{checked?"☑":"☐"}</Text><Text style={{flex:1,color:colors.ink,fontSize:13}}>{row.id} · {text}</Text>
            </Pressable>;
          })}
          {filtered.length>30?<View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>
            {chip("السابق",false,()=>setPage((value)=>Math.max(0,value-1)))}
            <Text style={{color:colors.ink,alignSelf:"center"}}>{page+1} / {Math.ceil(filtered.length/30)}</Text>
            {chip("التالي",false,()=>setPage((value)=>Math.min(Math.ceil(filtered.length/30)-1,value+1)))}
          </View>:null}
          <Text style={{color:colors.muted,fontSize:13}}>المعاينة تتضمن جميع الصفوف والأعمدة المختارة. تُقسّم الجداول العريضة إلى مجموعات أعمدة متتابعة دون حذف البيانات.</Text>
        </ScrollView>
        <View style={{padding:16,borderTopWidth:1,borderColor:colors.border,flexDirection:"row",flexWrap:"wrap",gap:10}}>
          {busy?<ActivityIndicator color={colors.blue}/>:null}
          {[{label:"معاينة والطباعة",pdf:false},{label:"حفظ PDF",pdf:true}].map((action)=><Pressable key={action.label} accessibilityRole="button"
            disabled={busy||loading||!report||!count} onPress={()=>void preview(action.pdf)}
            style={{flexGrow:1,minHeight:48,padding:12,borderRadius:10,backgroundColor:colors.action,alignItems:"center",justifyContent:"center",opacity:busy||loading||!count?0.5:1}}>
            <Text style={{color:"#fff",fontSize:14,fontWeight:"700"}}>{t(action.label)}</Text>
          </Pressable>)}
          <Text style={{color:colors.muted,fontSize:12,width:"100%"}}>تحديد الطابعة والنسخ والورق من نافذة النظام. على الهاتف يتطلب توفر خدمة طباعة Android وطابعة متوافقة؛ PDF يُحفظ أو يُشارك عبر النظام.</Text>
        </View>
      </View>
    </Modal>
    {documentFile&&Platform.OS==="web"?<DocumentPreview document={documentFile} onClose={()=>setDocumentFile(null)}
      onDownload={()=>openDeviceDocument(documentFile,true)} onNativeOpen={()=>openDeviceDocument(documentFile)}/>:null}
  </PrintingContext.Provider>;
}
