import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type { PrintOptions } from "../shared/printing";

export function openPrintWindow() {
  if (Platform.OS !== "web") return null;
  const preview=window.open("","_blank");
  if(!preview) throw new Error("اسمح بفتح نافذة المعاينة من إعدادات المتصفح.");
  preview.document.write('<!doctype html><html dir="rtl"><meta charset="utf-8"><title>BENNINI ETPI</title><body style="font-family:sans-serif;padding:30px">جارٍ إعداد معاينة الطباعة…</body></html>');
  return preview;
}

export async function outputPrintHtml(html:string, options:PrintOptions, pdf:boolean, preview:Window|null) {
  if(Platform.OS==="web") {
    if(!preview) throw new Error("تعذر فتح نافذة المعاينة.");
    preview.document.open(); preview.document.write(html); preview.document.close();
    preview.focus();
    return;
  }
  if(pdf) {
    const paper=options.paper==="A3" ? [842,1191] : options.paper==="Letter" ? [612,792] : [595,842];
    const [width,height]=options.landscape ? [paper[1],paper[0]] : paper;
    const result=await Print.printToFileAsync({html,width,height,base64:false});
    if(!(await Sharing.isAvailableAsync())) throw new Error("المشاركة غير متاحة على هذا الجهاز.");
    await Sharing.shareAsync(result.uri,{mimeType:"application/pdf",UTI:".pdf",dialogTitle:"حفظ أو مشاركة PDF"});
  } else {
    await Print.printAsync({html,orientation:options.landscape ? Print.Orientation.landscape : Print.Orientation.portrait});
  }
}
