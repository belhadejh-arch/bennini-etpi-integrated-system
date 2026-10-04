import { useState, useEffect } from "react";
import { Users, Shield, UserPlus, Check, X, Edit2, Trash2, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { useAuth, type UserProfile, type UserPermissions } from "@/context/AuthContext";

export function UsersPermissionsModule() {
  const { profile, recordAuditLog, hasPermission } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);

  // New user form
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("رئيس أشغال");

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "userProfiles"),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as UserProfile);
        setUsers(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "userProfiles");
      },
    );

    return () => unsub();
  }, []);

  const handleSavePermissions = async (userToUpdate: UserProfile) => {
    try {
      const docRef = doc(db, "userProfiles", userToUpdate.id);
      await updateDoc(docRef, { ...userToUpdate });
      await recordAuditLog(
        "تعديل صلاحيات المستخدم",
        "المستخدمون والصلاحيات",
        `تعديل صلاحيات ${userToUpdate.name} (${userToUpdate.email})`,
      );
      setIsEditModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `userProfiles/${userToUpdate.id}`);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newName) return;

    try {
      const customUid = `user_${Date.now()}`;
      const newUser: UserProfile = {
        id: customUid,
        uid: customUid,
        name: newName,
        email: newEmail,
        role: newRole,
        canViewFinance: newRole === "محاسب" || newRole.includes("مدير"),
        canEditFinance: newRole === "محاسب" || newRole.includes("مدير"),
        canViewInventory: true,
        canEditInventory: newRole !== "عامل",
        canViewCheques: newRole === "محاسب" || newRole.includes("مدير"),
        canEditCheques: newRole === "محاسب" || newRole.includes("مدير"),
        canViewRentals: true,
        canEditRentals: newRole.includes("مدير"),
        canViewMachinery: true,
        canEditMachinery: newRole !== "عامل",
        canViewFieldPortal: true,
        canManageUsers: newRole.includes("مدير"),
        canDeleteRecords: newRole.includes("مدير"),
        canUploadFiles: true,
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "userProfiles", customUid), newUser);
      await recordAuditLog(
        "إنشاء حساب مستخدم",
        "المستخدمون والصلاحيات",
        `إنشاء حساب ${newName} بدور ${newRole}`,
      );
      setIsNewUserModalOpen(false);
      setNewEmail("");
      setNewName("");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "userProfiles");
    }
  };

  const isMainAdmin = profile?.role.includes("المدير");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#07152f]">
            إدارة المستخدمين والصلاحيات الدقيقة 👥
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            صاحب الشركة / المدير يتحكم بالكامل في صلاحيات كل مستخدم وتحديد ما يراه، يضيفه، يعدله، أو
            يحذفه.
          </p>
        </div>

        {isMainAdmin && (
          <Button
            onClick={() => setIsNewUserModalOpen(true)}
            className="bg-[#083c7a] hover:bg-[#05326f] text-white font-bold gap-2 text-xs"
          >
            <UserPlus className="h-4 w-4" /> إضافة مستخدم جديد وتحديد أدواره
          </Button>
        )}
      </div>

      {/* Users List Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-right text-sm">
            <thead className="bg-[#05326f] text-white">
              <tr>
                <th className="px-4 py-3.5 font-bold">المستخدم</th>
                <th className="px-4 py-3.5 font-bold">البريد الإلكتروني</th>
                <th className="px-4 py-3.5 font-bold">الدور الوظيفي</th>
                <th className="px-4 py-3.5 font-bold text-center">المالية</th>
                <th className="px-4 py-3.5 font-bold text-center">المخزون</th>
                <th className="px-4 py-3.5 font-bold text-center">الشيكات</th>
                <th className="px-4 py-3.5 font-bold text-center">الكراء</th>
                <th className="px-4 py-3.5 font-bold text-center">الآليات</th>
                <th className="px-4 py-3.5 font-bold text-center">بوابة الهاتف</th>
                <th className="px-4 py-3.5 font-bold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3.5 font-bold text-[#07152f] flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-[#083c7a] text-white text-xs font-bold">
                      {u.name.slice(0, 2)}
                    </div>
                    {u.name}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-muted-foreground font-mono">{u.email}</td>
                  <td className="px-4 py-3.5">
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-[#083c7a]">
                      {u.role}
                    </span>
                  </td>

                  {/* Financial perm indicator */}
                  <td className="px-4 py-3.5 text-center">
                    {u.canViewFinance ? (
                      <span className="text-emerald-600 font-bold">
                        ✓ {u.canEditFinance ? "تعديل" : "عرض"}
                      </span>
                    ) : (
                      <span className="text-rose-400 font-bold">✗ ممنوع</span>
                    )}
                  </td>

                  {/* Inventory perm indicator */}
                  <td className="px-4 py-3.5 text-center">
                    {u.canViewInventory ? (
                      <span className="text-emerald-600 font-bold">
                        ✓ {u.canEditInventory ? "تعديل" : "عرض"}
                      </span>
                    ) : (
                      <span className="text-rose-400 font-bold">✗</span>
                    )}
                  </td>

                  {/* Cheques perm indicator */}
                  <td className="px-4 py-3.5 text-center">
                    {u.canViewCheques ? (
                      <span className="text-emerald-600 font-bold">
                        ✓ {u.canEditCheques ? "تعديل" : "عرض"}
                      </span>
                    ) : (
                      <span className="text-rose-400 font-bold">✗ ممنوع</span>
                    )}
                  </td>

                  {/* Rentals perm indicator */}
                  <td className="px-4 py-3.5 text-center">
                    {u.canViewRentals ? (
                      <span className="text-emerald-600 font-bold">✓</span>
                    ) : (
                      <span className="text-rose-400 font-bold">✗</span>
                    )}
                  </td>

                  {/* Machinery perm indicator */}
                  <td className="px-4 py-3.5 text-center">
                    {u.canViewMachinery ? (
                      <span className="text-emerald-600 font-bold">✓</span>
                    ) : (
                      <span className="text-rose-400 font-bold">✗</span>
                    )}
                  </td>

                  {/* Field portal perm indicator */}
                  <td className="px-4 py-3.5 text-center">
                    {u.canViewFieldPortal ? (
                      <span className="text-emerald-600 font-bold">✓ متاح</span>
                    ) : (
                      <span className="text-rose-400 font-bold">✗</span>
                    )}
                  </td>

                  <td className="px-4 py-3.5 text-center">
                    {isMainAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedUser({ ...u });
                          setIsEditModalOpen(true);
                        }}
                        className="text-xs font-bold gap-1 text-[#083c7a]"
                      >
                        <Shield className="h-3.5 w-3.5" /> تعديل الصلاحيات
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Permissions Modal */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-[#07152f]">
              تعديل صلاحيات المستخدم: {selectedUser.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              البريد: {selectedUser.email} • الدور: {selectedUser.role}
            </p>

            <div className="mt-5 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="rounded-xl border border-border p-4 bg-slate-50 space-y-3">
                <strong className="block text-xs font-bold text-[#083c7a]">
                  1. قسم التسيير المالي والشيكات الحساسة
                </strong>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedUser.canViewFinance}
                      onChange={(e) =>
                        setSelectedUser({ ...selectedUser, canViewFinance: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span>رؤية التسيير المالي</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedUser.canEditFinance}
                      onChange={(e) =>
                        setSelectedUser({ ...selectedUser, canEditFinance: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span>إضافة وتعديل المعاملات المالية</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedUser.canViewCheques}
                      onChange={(e) =>
                        setSelectedUser({ ...selectedUser, canViewCheques: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span>رؤية إدارة الشيكات</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedUser.canEditCheques}
                      onChange={(e) =>
                        setSelectedUser({ ...selectedUser, canEditCheques: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span>إصدار وتعديل الشيكات</span>
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-border p-4 bg-slate-50 space-y-3">
                <strong className="block text-xs font-bold text-[#083c7a]">
                  2. المشتريات، المخزون، والآليات
                </strong>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedUser.canViewInventory}
                      onChange={(e) =>
                        setSelectedUser({ ...selectedUser, canViewInventory: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span>رؤية المشتريات والمخزون</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedUser.canEditInventory}
                      onChange={(e) =>
                        setSelectedUser({ ...selectedUser, canEditInventory: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span>إضافة سلع وشراء للمخزون</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedUser.canViewMachinery}
                      onChange={(e) =>
                        setSelectedUser({ ...selectedUser, canViewMachinery: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span>رؤية الآليات وقطع الغيار</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedUser.canEditMachinery}
                      onChange={(e) =>
                        setSelectedUser({ ...selectedUser, canEditMachinery: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span>تسجيل قطع الغيار والإصلاح</span>
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-border p-4 bg-slate-50 space-y-3">
                <strong className="block text-xs font-bold text-[#083c7a]">
                  3. الصلاحيات الميدانية والإدارية العامة
                </strong>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedUser.canViewFieldPortal}
                      onChange={(e) =>
                        setSelectedUser({ ...selectedUser, canViewFieldPortal: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span>الوصول لتطبيق رئيس الأشغال الميداني</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedUser.canUploadFiles}
                      onChange={(e) =>
                        setSelectedUser({ ...selectedUser, canUploadFiles: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span>إمكانية رفع الصور والوثائق</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedUser.canDeleteRecords}
                      onChange={(e) =>
                        setSelectedUser({ ...selectedUser, canDeleteRecords: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span className="text-rose-700 font-bold">صلاحية حذف السجلات</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedUser.canManageUsers}
                      onChange={(e) =>
                        setSelectedUser({ ...selectedUser, canManageUsers: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span className="text-rose-700 font-bold">إدارة المستخدمين والصلاحيات</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                إلغاء
              </Button>
              <Button
                onClick={() => handleSavePermissions(selectedUser)}
                className="bg-[#083c7a] text-white font-bold"
              >
                تطبيق الصلاحيات فورياً
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* New User Modal */}
      {isNewUserModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-[#07152f]">إضافة مستخدم جديد للنظام 👤</h3>
            <form onSubmit={handleCreateUser} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  اسم المستخدم الكامل
                </label>
                <Input
                  required
                  placeholder="مثال: أحمد قادري"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">البريد الإلكتروني</label>
                <Input
                  type="email"
                  required
                  placeholder="user@bennini-etpi.dz"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">الدور المقترح</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="رئيس أشغال">رئيس أشغال (ميداني)</option>
                  <option value="محاسب">محاسب (مالية ومشتريات)</option>
                  <option value="مسؤول مشتريات ومخزون">مسؤول مشتريات ومخزون</option>
                  <option value="مسؤول آليات وصيانة">مسؤول آليات وصيانة</option>
                  <option value="عامل ميداني">عامل ميداني</option>
                  <option value="مدير إداري">مدير إداري</option>
                </select>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsNewUserModalOpen(false)}
                >
                  إلغاء
                </Button>
                <Button type="submit" className="bg-[#083c7a] text-white font-bold">
                  إنشاء الحساب
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
