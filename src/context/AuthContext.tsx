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

interface AuthContextType {
  currentUser: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  currentPortal: PortalType;
  switchPortal: (portal: PortalType) => void;
  getPortalUrl: (portal: PortalType) => string;
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPortal, setCurrentPortal] = useState<PortalType>("manager");

  useEffect(() => {
    const portal = detectPortalFromUrl();
    setCurrentPortal(portal);

    const handlePopState = () => {
      setCurrentPortal(detectPortalFromUrl());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setProfile(null);
      setIsAdmin(false);

      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        let tokenResult = await user.getIdTokenResult();
        const apiBaseUrl = import.meta.env["VITE_API_BASE_URL"]?.trim();

        if (apiBaseUrl) {
          try {
            const response = await fetch(`${apiBaseUrl.replace(/\/+$/, "")}/api/admin/bootstrap`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${await user.getIdToken()}`,
                "Content-Type": "application/json",
              },
              body: "{}",
            });
            if (!response.ok) {
              throw new Error(`Admin bootstrap failed (${response.status})`);
            }
            await response.json();
            await user.getIdToken(true);
            tokenResult = await user.getIdTokenResult();
          } catch (error) {
            const isUnauthorized = error instanceof Error && error.message.includes("(403)");
            if (!isUnauthorized) {
              console.error("Could not verify the administrator role with the Render API:", error);
            }
            if (isUnauthorized) {
              await user.getIdToken(true);
              tokenResult = await user.getIdTokenResult();
            }
          }
        }

        const hasAdminClaim = tokenResult.claims["role"] === "admin";
        setIsAdmin(hasAdminClaim);

        const userDocRef = doc(db, "userProfiles", user.uid);
        const userSnap = await getDoc(userDocRef);
        let userProfile: UserProfile;

        if (userSnap.exists()) {
          const data = userSnap.data() as UserProfile;
          const accountCategory: AccountCategory = hasAdminClaim
            ? "manager"
            : data.accountCategory === "worker"
              ? "worker"
              : "staff";
          userProfile = {
            ...data,
            id: user.uid,
            uid: user.uid,
            name: user.displayName || data.name || user.email?.split("@")[0] || "مستخدم",
            email: user.email || data.email || "",
            accountCategory,
            role: hasAdminClaim
              ? "المدير العام / المدير"
              : accountCategory === "worker"
                ? "رئيس أشغال"
                : "موظف / رئيس أشغال",
            ...(hasAdminClaim ? DEFAULT_ADMIN_PERMISSIONS : {}),
          };
        } else {
          userProfile = {
            id: user.uid,
            uid: user.uid,
            name: user.displayName || user.email?.split("@")[0] || "مستخدم",
            email: user.email || "",
            role: hasAdminClaim ? "المدير العام / المدير" : "موظف / رئيس أشغال",
            accountCategory: hasAdminClaim ? "manager" : "staff",
            ...(hasAdminClaim ? DEFAULT_ADMIN_PERMISSIONS : DEFAULT_STAFF_PERMISSIONS),
            createdAt: new Date().toISOString(),
          };
          await setDoc(userDocRef, userProfile);
        }
        setProfile(userProfile);
      } catch (error) {
        console.error("Error loading the signed-in user's profile:", error);
      } finally {
        setLoading(false);
      }
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

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, "auth");
    }
  };

  const logout = async () => {
    await firebaseSignOut(auth);
    setProfile(null);
    setIsAdmin(false);
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
    if (isAdmin) return true;
    return Boolean(profile[permKey]);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        profile,
        isAdmin,
        loading,
        currentPortal,
        switchPortal,
        getPortalUrl,
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
