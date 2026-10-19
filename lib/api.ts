import Constants from "expo-constants";
import { Platform } from "react-native";
import type { MemberCapabilities, MemberPermissions } from "../shared/access";
import type { SectionId } from "../shared/sections";
import { createRequestCoordinator } from "./request-coordinator";
import { fetchWithRecovery, NetworkRequestError } from "./http-recovery";
const requests = createRequestCoordinator();
import { apiErrorFrench } from "../shared/api-error-translations";
let responseLanguage: "ar" | "fr" = "ar";
export function setResponseLanguage(language: "ar" | "fr") { responseLanguage = language; }
const knownErrors: Record<string, string> = {
  ...apiErrorFrench,
  "تعذر الاتصال بالخادم.": "Impossible de contacter le serveur.",
  "يلزم إعداد عنوان الخادم قبل تشغيل تطبيق الهاتف.": "L’adresse du serveur doit être configurée avant de lancer l’application mobile.",
  "انتهت جلسة الدخول.": "Votre session a expiré.",
  "لا تملك صلاحية الوصول إلى هذا القسم.": "Vous n’avez pas l’autorisation d’accéder à cette section.",
  "الحساب غير مفعل.": "Ce compte n’est pas activé.",
  "تعذر الاتصال بالخادم. يرجى إعادة المحاولة.": "Impossible de contacter le serveur. Réessayez.",
  "تعذر تأكيد نتيجة العملية. تحقق من السجل قبل إعادة الإرسال.": "Impossible de confirmer le résultat. Vérifiez le registre avant de renvoyer l’opération.",
  "استجابة الخادم غير صالحة. يرجى إعادة المحاولة.": "La réponse du serveur est invalide. Réessayez.",
};
export function localizeApiError(message: string, language: "ar" | "fr" = responseLanguage) {
  return language === "fr" ? (knownErrors[message] ?? message) : message;
}

const configuredApiUrl = Constants.expoConfig?.extra?.apiUrl as string | undefined;
const configuredWebApiUrl = Constants.expoConfig?.extra?.webApiUrl as string | undefined;

export function apiUrl(path: string): string {
  const baseUrl = Platform.OS === "web" ? configuredWebApiUrl : configuredApiUrl;
  if (Platform.OS !== "web" && !baseUrl) {
    throw new Error("يلزم إعداد عنوان الخادم قبل تشغيل تطبيق الهاتف.");
  }
  return `${baseUrl ?? ""}${path}`;
}

export async function apiRequest<T>(
  path: string,
  getToken: () => Promise<string | null>,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const method = (options.method ?? "GET").toUpperCase();
  const requestLanguage = responseLanguage;
  const isWrite = !["GET", "HEAD", "OPTIONS"].includes(method);
  if (isWrite) requests.invalidate();
  const perform = async (): Promise<T> => {
    try {
      const response = await fetchWithRecovery(apiUrl(`/api${path}`), {
        ...options,
        headers: {
          Accept: "application/json",
          ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(Platform.OS !== "web" ? { "X-App-Client": "native" } : {}),
          ...options.headers,
        },
        credentials: "include",
      });
      const isJson = response.headers.get("content-type")?.includes("application/json");
      let parsed: unknown;
      try { parsed = isJson ? await response.json() : null; } catch { parsed = null; }
      if (response.ok && response.status !== 204 && (parsed === null || typeof parsed !== "object")) {
        throw new Error(localizeApiError("استجابة الخادم غير صالحة. يرجى إعادة المحاولة.", requestLanguage));
      }
      const body = (parsed ?? {}) as T & { error?: string };
      if (!response.ok) {
        const requestId = response.headers.get("x-request-id");
        const message = localizeApiError(body.error || "تعذر الاتصال بالخادم.", requestLanguage);
        const reference = requestId && response.status >= 500
          ? ` (${requestLanguage === "fr" ? "Référence" : "مرجع"}: ${requestId.slice(0, 8)})` : "";
        const error = new Error(message + reference) as Error & { status?: number; body?: unknown; requestId?: string };
        error.status = response.status;
        error.body = body;
        error.requestId = requestId ?? undefined;
        throw error;
      }
      return body;
    } catch (error) {
      if (error instanceof NetworkRequestError) {
        throw new Error(localizeApiError(error.message, requestLanguage));
      }
      throw error;
    } finally {
      // Also invalidate reads started while the write was still in progress.
      if (isWrite) requests.invalidate();
    }
  };
  if (method !== "GET" || options.body || options.signal) return perform();
  const headerKey = JSON.stringify(Array.from(new Headers(options.headers).entries()).sort(([a], [b]) => a.localeCompare(b)));
  return requests.read(JSON.stringify([path, token, requestLanguage, headerKey, options.credentials, options.cache]), perform);
}

export type Member = {
  clerk_user_id: string;
  email: string;
  name: string;
  role: string;
  has_serial?: boolean;
  serial_recoverable?: boolean;
  role_name?: string;
  active: boolean;
  allowed_sections: string[];
  permissions?: MemberPermissions;
  capabilities?: MemberCapabilities;
  notes?: string;
  language?: "ar" | "fr";
  appearance?: "light" | "dark" | "system";
};

export type Language = "ar" | "fr";
export type Appearance = "light" | "dark" | "system";

export type AppNotification = {
  id: string;
  type: "cheque_due" | "rental_ending" | "new_expense" | "field_operation" | "field_review" | "low_inventory" | "low_spare_part" | "driver_month_anniversary";
  title: string;
  message: string;
  section: SectionId;
  view?: string;
  recordId: number;
  machineId?: number;
  createdAt: string;
  read: boolean;
};

export type NotificationsResult = {
  items: AppNotification[];
  unreadCount: number;
};

export type DashboardData = {
  stats: {
    incoming: number;
    outgoing: number;
    balance: number;
    purchases: number;
    inventoryValue: number;
    pendingCheques: number;
    pendingChequeCount: number;
    dueCheques: number;
    dueChequeCount: number;
    rentalRemaining: number;
  };
  recentOperations: Array<{
    id: number;
    type: "income" | "expense";
    amount: number | string;
    party: string;
    reason: string;
    date: string;
    recorded_by: string;
    notes: string;
  }>;
  fieldExpenses: Array<{
    id: number;
    category: string;
    amount: number | string | null;
    site_name: string;
    details: string;
    notes: string;
    created_by_name: string;
    created_at: string;
    fuel_liters: number | string | null;
    review_status: "pending" | "reviewed";
    created_by_id: string;
  }>;
};
