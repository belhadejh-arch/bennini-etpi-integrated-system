import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type { PrintOptions } from "../shared/printing";

export async function outputPrintHtml(html:string, options:PrintOptions, pdf:boolean) {
  if(Platform.OS==="web")throw new Error("استخدم معاينة PDF داخل التطبيق.");
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
