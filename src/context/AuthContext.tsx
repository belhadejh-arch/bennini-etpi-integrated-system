import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, collection, addDoc, onSnapshot } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "@/lib/firebase";

export type AccountCategory = "manager" | "staff" | "worker";
export type PortalType = "manager" | "staff" | "field";

export interface UserPermissions {
  canViewFinance: boolean;
  canEditFinance: boolean;
  canViewInventory: boolean;
  canEditInventory: boolean;
  canViewCheques: boolean;
  canEditCheques: boolean;
  canViewRentals: boolean;
  canEditRentals: boolean;
  canViewMachinery: boolean;
  canEditMachinery: boolean;
  canViewFieldPortal: boolean;
  canManageUsers: boolean;
  canDeleteRecords: boolean;
  canUploadFiles: boolean;
}

export interface UserProfile extends UserPermissions {
  id: string;
  uid: string;
  name: string;
  email: string;
  role: string;
  accountCategory: AccountCategory;
  workerCode?: string;
  siteAssigned?: string;
  createdAt: string;
}

const DEFAULT_ADMIN_PERMISSIONS: UserPermissions = {
  canViewFinance: true,
  canEditFinance: true,
  canViewInventory: true,
  canEditInventory: true,
  canViewCheques: true,
  canEditCheques: true,
  canViewRentals: true,
  canEditRentals: true,
  canViewMachinery: true,
  canEditMachinery: true,
  canViewFieldPortal: true,
  canManageUsers: true,
  canDeleteRecords: true,
  canUploadFiles: true,
};

const DEFAULT_STAFF_PERMISSIONS: UserPermissions = {
  canViewFinance: false,
  canEditFinance: false,
  canViewInventory: true,
  canEditInventory: true,
  canViewCheques: true,
  canEditCheques: false,
  canViewRentals: true,
  canEditRentals: false,
  canViewMachinery: true,
  canEditMachinery: true,
  canViewFieldPortal: true,
  canManageUsers: false,
  canDeleteRecords: false,
  canUploadFiles: true,
};

const DEFAULT_WORKER_PERMISSIONS: UserPermissions = {
  canViewFinance: false,
  canEditFinance: false,
  canViewInventory: false,
  canEditInventory: false,
  canViewCheques: false,
  canEditCheques: false,
  canViewRentals: false,
  canEditRentals: false,
  canViewMachinery: false,
  canEditMachinery: false,
  canViewFieldPortal: true,
  canManageUsers: false,
  canDeleteRecords: false,
  canUploadFiles: true,
};

export const PRESET_ACCOUNTS = {
  manager: {
    uid: "manager_bennini_main",
    name: "محمد هارون بن نيني (المدير العام)",
    email: "mohamedharoun329@gmail.com",
    role: "المدير العام / الإدارة العليا",
    accountCategory: "manager" as const,
    siteAssigned: "المقر الرئيسي - الإدارة المركزية",
    permissions: DEFAULT_ADMIN_PERMISSIONS,
  },
  staff: {
    uid: "staff_yassine_ops",
    name: "ياسين بن عمارة (موظف إداري)",
    email: "staff.yassine@bennini-etpi.dz",
    role: "موظف إداري / محاسب وأمين مخزن",
    accountCategory: "staff" as const,
    siteAssigned: "مكتب الإدارة والمخزن المركزي",
    permissions: DEFAULT_STAFF_PERMISSIONS,
  },
  worker: {
    uid: "worker_ahmed_field",
    name: "أحمد قادري (رئيس أشغال)",
    email: "worker.ahmed@bennini-etpi.dz",
    role: "رئيس أشغال ورشة الطريق الولائي 14",
    accountCategory: "worker" as const,
    workerCode: "WRK-014",
    siteAssigned: "ورشة الطريق الولائي رقم 14 - البليدة",
    permissions: DEFAULT_WORKER_PERMISSIONS,
  },
};

interface AuthContextType {
  currentUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  currentPortal: PortalType;
  switchPortal: (portal: PortalType) => void;
  getPortalUrl: (portal: PortalType) => string;
  loginAsRole: (category: AccountCategory, customName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  recordAuditLog: (action: string, section: string, details: string) => Promise<void>;
  hasPermission: (permKey: keyof UserPermissions) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function detectPortalFromUrl(): PortalType {
  if (typeof window === "undefined") return "manager";
  const params = new URLSearchParams(window.location.search);
  const portalParam = params.get("portal");
  if (portalParam === "field" || portalParam === "worker" || portalParam === "workers") {
    return "field";
  }
  if (portalParam === "staff" || portalParam === "employee") {
    return "staff";
  }
  return "manager";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPortal, setCurrentPortal] = useState<PortalType>("manager");

  // Read URL params on mount
  useEffect(() => {
    const portal = detectPortalFromUrl();
    setCurrentPortal(portal);

    // Default to corresponding role if not logged in
    const storedRole = localStorage.getItem("bennini_active_role") as AccountCategory | null;
    if (storedRole && PRESET_ACCOUNTS[storedRole]) {
      const preset = PRESET_ACCOUNTS[storedRole];
      setProfile({
        id: preset.uid,
        uid: preset.uid,
        name: preset.name,
        email: preset.email,
        role: preset.role,
        accountCategory: preset.accountCategory,
        siteAssigned: preset.siteAssigned,
        workerCode: "workerCode" in preset ? preset.workerCode : undefined,
        createdAt: new Date().toISOString(),
        ...preset.permissions,
      });
    } else {
      // Default to manager for full access initially
      const preset = PRESET_ACCOUNTS.manager;
      setProfile({
        id: preset.uid,
        uid: preset.uid,
        name: preset.name,
        email: preset.email,
        role: preset.role,
        accountCategory: preset.accountCategory,
        siteAssigned: preset.siteAssigned,
        createdAt: new Date().toISOString(),
        ...preset.permissions,
      });
    }

    const handlePopState = () => {
      setCurrentPortal(detectPortalFromUrl());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDocRef = doc(db, "userProfiles", user.uid);
          const userSnap = await getDoc(userDocRef);

          const isMainAdmin =
            user.email === "mohamedharoun329@gmail.com" ||
            user.email?.toLowerCase().includes("bennini");

          if (userSnap.exists()) {
            const data = userSnap.data() as UserProfile;
            if (isMainAdmin) {
              setProfile({
                ...data,
                ...DEFAULT_ADMIN_PERMISSIONS,
                accountCategory: "manager",
                role: "المدير العام / المدير",
              });
            } else {
              setProfile(data);
            }
          } else {
            // First time registration
            const accountCategory: AccountCategory = isMainAdmin ? "manager" : "staff";
            const newProfile: UserProfile = {
              id: user.uid,
              uid: user.uid,
              name: user.displayName || user.email?.split("@")[0] || "مستخدم جديد",
              email: user.email || "",
              role: isMainAdmin ? "المدير العام / المدير" : "موظف / رئيس أشغال",
              accountCategory,
              ...(isMainAdmin ? DEFAULT_ADMIN_PERMISSIONS : DEFAULT_STAFF_PERMISSIONS),
              createdAt: new Date().toISOString(),
            };

            await setDoc(userDocRef, newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const switchPortal = (portal: PortalType) => {
    setCurrentPortal(portal);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("portal", portal);
      window.history.pushState({}, "", url.toString());
    }
  };

  const getPortalUrl = (portal: PortalType): string => {
    if (typeof window === "undefined") return `/?portal=${portal}`;
    return `${window.location.origin}/?portal=${portal}`;
  };

  const loginAsRole = async (category: AccountCategory, customName?: string) => {
    const preset = PRESET_ACCOUNTS[category];
    const newProfile: UserProfile = {
      id: preset.uid,
      uid: preset.uid,
      name: customName || preset.name,
      email: preset.email,
      role: preset.role,
      accountCategory: preset.accountCategory,
      siteAssigned: preset.siteAssigned,
      workerCode: "workerCode" in preset ? preset.workerCode : undefined,
      createdAt: new Date().toISOString(),
      ...preset.permissions,
    };

    localStorage.setItem("bennini_active_role", category);
    setProfile(newProfile);

    // Switch to corresponding portal
    if (category === "worker") {
      switchPortal("field");
    } else if (category === "staff") {
      switchPortal("staff");
    } else {
      switchPortal("manager");
    }

    try {
      // Sync to Firestore userProfiles
      await setDoc(doc(db, "userProfiles", preset.uid), newProfile);
      await recordAuditLog(
        "تسجيل دخول بالدور",
        "الأمان والمصادقة",
        `دخول ${newProfile.name} بدور ${newProfile.role} عبر البوابة المخصصة`,
      );
    } catch (e) {
      console.warn("Could not sync role to Firestore:", e);
    }
  };

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, "auth");
    }
  };

  const logout = async () => {
    localStorage.removeItem("bennini_active_role");
    await firebaseSignOut(auth);
    // Reset to worker or staff portal if currently logged out
    const preset = PRESET_ACCOUNTS.manager;
    setProfile(null);
  };

  const recordAuditLog = async (action: string, section: string, details: string) => {
    try {
      await addDoc(collection(db, "auditLogs"), {
        userName: profile?.name || currentUser?.displayName || currentUser?.email || "نظام",
        userId: profile?.uid || currentUser?.uid || "system",
        action,
        section,
        details,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("Audit log error:", error);
    }
  };

  const hasPermission = (permKey: keyof UserPermissions): boolean => {
    if (!profile) return false;
    if (
      profile.accountCategory === "manager" ||
      profile.role.includes("المدير العام") ||
      profile.role.includes("المدير")
    ) {
      return true;
    }
    return Boolean(profile[permKey]);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        profile,
        loading,
        currentPortal,
        switchPortal,
        getPortalUrl,
        loginAsRole,
        signInWithGoogle,
        logout,
        recordAuditLog,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
