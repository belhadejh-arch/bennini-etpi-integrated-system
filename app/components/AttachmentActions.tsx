import { useAuth } from "@clerk/expo";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Download, Eye, FileText, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from "react-native";
import { apiRequest, apiUrl } from "../../lib/api";
import { colors } from "../../lib/theme";
import type { SectionId } from "../../shared/sections";

export type AttachmentFile = {
  id: number;
  file_name: string;
  mime_type: string;
  file_size: number;
};

export default function AttachmentActions({
  attachment,
  section,
  url,
  canDelete,
  onDeleted,
}: {
  attachment: AttachmentFile;
  section: SectionId;
  url: string;
  canDelete: boolean;
  onDeleted: (id: number) => void;
}) {
  const { getToken } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const openOrDownload = async (action: "open" | "download") => {
    let openedWindow: Window | null = null;
    try {
      setBusy(true);
      setError("");
      if (Platform.OS === "web" && action === "open") {
        openedWindow = window.open("about:blank", "_blank");
        if (!openedWindow) throw new Error("اسمح بفتح نافذة جديدة لعرض الملف.");
      }

      const token = await getToken();
      if (!token) throw new Error("انتهت جلسة الدخول.");
      const response = await fetch(apiUrl(url), { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("تعذر تحميل الملف. تحقق من صلاحية الوصول إلى السجل.");

      if (Platform.OS === "web") {
        const objectUrl = URL.createObjectURL(await response.blob());
        if (action === "open" && openedWindow) {
          openedWindow.opener = null;
          openedWindow.location.href = objectUrl;
        } else {
          const link = document.createElement("a");
          link.href = objectUrl;
          link.download = attachment.file_name;
          document.body.appendChild(link);
          link.click();
          link.remove();
        }
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      } else {
        const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
        if (!base) throw new Error("مساحة حفظ الملفات غير متاحة.");
        const safeName = attachment.file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const localFile = await FileSystem.downloadAsync(apiUrl(url), `${base}${Date.now()}-${safeName}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (localFile.status < 200 || localFile.status >= 300) {
          throw new Error("تعذر تنزيل الملف. تحقق من صلاحية الوصول إلى السجل.");
        }
        if (!(await Sharing.isAvailableAsync())) throw new Error("لا تتوفر مشاركة الملفات على هذا الجهاز.");
        await Sharing.shareAsync(localFile.uri, {
          mimeType: attachment.mime_type,
          dialogTitle: action === "open" ? `فتح ${attachment.file_name}` : `تنزيل ${attachment.file_name}`,
        });
      }
    } catch (caught) {
      openedWindow?.close();
      setError(caught instanceof Error ? caught.message : "تعذر فتح الملف.");
    } finally {
      setBusy(false);
    }
  };

  const deleteAttachment = () => {
    const remove = async () => {
      try {
        setBusy(true);
        setError("");
        await apiRequest(`/attachments/${section}/${attachment.id}`, getToken, { method: "DELETE" });
        onDeleted(attachment.id);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "تعذر حذف الملف.");
      } finally {
        setBusy(false);
      }
    };
    const message = `سيتم حذف الملف «${attachment.file_name}» من السجل. لا يمكن التراجع عن هذا الإجراء.`;
    if (Platform.OS === "web") {
      if (window.confirm(message)) void remove();
    } else {
      Alert.alert("حذف المرفق", message, [
        { text: "إلغاء", style: "cancel" },
        { text: "حذف", style: "destructive", onPress: () => void remove() },
      ]);
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <FileText size={15} color={colors.blue} />
        <Text numberOfLines={1} style={styles.name}>{attachment.file_name}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`فتح ${attachment.file_name}`}
          disabled={busy} onPress={() => void openOrDownload("open")} style={styles.action}>
          {busy ? <ActivityIndicator size="small" color={colors.blue} /> : <Eye size={15} color={colors.blue} />}
          <Text style={styles.actionText}>فتح</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`تنزيل ${attachment.file_name}`}
          disabled={busy} onPress={() => void openOrDownload("download")} style={styles.action}>
          <Download size={15} color={colors.blue} />
          <Text style={styles.actionText}>تنزيل</Text>
        </Pressable>
        {canDelete ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`حذف ${attachment.file_name}`}
            disabled={busy} onPress={deleteAttachment} style={[styles.action, styles.deleteAction]}>
            <Trash2 size={15} color={colors.red} />
            <Text style={styles.deleteText}>حذف</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = {
  wrapper: { gap: 3 },
  row: {
    minHeight: 38,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    borderWidth: 1,
    borderColor: "#D6E3F2",
    borderRadius: 9,
    backgroundColor: "#F6F9FD",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  name: { flex: 1, minWidth: 40, color: colors.ink, fontSize: 11, fontWeight: "600" as const },
  action: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4, paddingVertical: 5 },
  actionText: { color: colors.blue, fontSize: 10, fontWeight: "700" as const },
  deleteAction: { marginLeft: 2 },
  deleteText: { color: colors.red, fontSize: 10, fontWeight: "700" as const },
  error: { color: colors.red, fontSize: 10, paddingHorizontal: 4 },
};
