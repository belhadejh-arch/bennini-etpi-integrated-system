import Constants from "expo-constants";
import { Platform } from "react-native";
import type { MemberPermissions } from "../shared/access";

const configuredApiUrl = Constants.expoConfig?.extra?.apiUrl as string | undefined;

export async function apiRequest<T>(
  path: string,
  getToken: () => Promise<string | null>,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const baseUrl = Platform.OS === "web" ? "" : configuredApiUrl;
  if (Platform.OS !== "web" && !baseUrl) {
    throw new Error("يلزم إعداد عنوان الخادم قبل تشغيل تطبيق الهاتف.");
  }

  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(`${baseUrl ?? ""}/api${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const body = (isJson ? await response.json().catch(() => ({})) : {}) as T & { error?: string };
  if (!response.ok) {
    const error = new Error(body.error || "تعذر الاتصال بالخادم.") as Error & { status?: number; body?: unknown };
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

export type Member = {
  clerk_user_id: string;
  email: string;
  name: string;
  role: string;
  role_name?: string;
  active: boolean;
  allowed_sections: string[];
  permissions?: MemberPermissions;
  notes?: string;
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
    amount: number | string;
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
