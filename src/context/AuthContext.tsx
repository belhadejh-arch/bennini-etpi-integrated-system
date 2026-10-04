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

interface AuthContextType {
  currentUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  recordAuditLog: (action: string, section: string, details: string) => Promise<void>;
  hasPermission: (permKey: keyof UserPermissions) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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
            // Ensure main admin always retains all permissions
            if (isMainAdmin) {
              setProfile({ ...data, ...DEFAULT_ADMIN_PERMISSIONS, role: "المدير العام / المدير" });
            } else {
              setProfile(data);
            }
          } else {
            // First time registration
            const newProfile: UserProfile = {
              id: user.uid,
              uid: user.uid,
              name: user.displayName || user.email?.split("@")[0] || "مستخدم جديد",
              email: user.email || "",
              role: isMainAdmin ? "المدير العام / المدير" : "موظف / رئيس أشغال",
              ...(isMainAdmin
                ? DEFAULT_ADMIN_PERMISSIONS
                : {
                    canViewFinance: false,
                    canEditFinance: false,
                    canViewInventory: true,
                    canEditInventory: true,
                    canViewCheques: false,
                    canEditCheques: false,
                    canViewRentals: true,
                    canEditRentals: false,
                    canViewMachinery: true,
                    canEditMachinery: true,
                    canViewFieldPortal: true,
                    canManageUsers: false,
                    canDeleteRecords: false,
                    canUploadFiles: true,
                  }),
              createdAt: new Date().toISOString(),
            };

            await setDoc(userDocRef, newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
  };

  const recordAuditLog = async (action: string, section: string, details: string) => {
    try {
      await addDoc(collection(db, "auditLogs"), {
        userName: profile?.name || currentUser?.displayName || currentUser?.email || "نظام",
        userId: currentUser?.uid || "system",
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
    if (profile.role.includes("المدير العام") || profile.role.includes("المدير")) return true;
    return Boolean(profile[permKey]);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        profile,
        loading,
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
