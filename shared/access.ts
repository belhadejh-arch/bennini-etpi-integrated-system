import { allSectionIds, type SectionId } from "./sections";

export const permissionActions = ["view", "create", "edit", "delete"] as const;
export type PermissionAction = (typeof permissionActions)[number];
export type SectionPermissions = Partial<Record<PermissionAction, boolean>>;
export type MemberPermissions = Partial<Record<SectionId, SectionPermissions>>;

export type PermissionMember = {
  role: string;
  allowed_sections?: string[];
  permissions?: MemberPermissions;
};

export function hasPermission(
  member: PermissionMember | null | undefined,
  section: SectionId,
  action: PermissionAction,
): boolean {
  if (!member) return false;
  if (member.role === "admin") return true;

  const saved = member.permissions?.[section];
  if (saved) return saved[action] === true;

  if (section === "dashboard") return action === "view";
  if (!member.allowed_sections?.includes(section)) return false;
  if (action === "view") return true;
  if (member.role === "finance") return true;
  return section === "field" &&
    (member.role === "field" || member.role === "supervisor") &&
    (action === "create" || action === "edit");
}

export function effectivePermissions(
  member: PermissionMember,
): Record<SectionId, Record<PermissionAction, boolean>> {
  return Object.fromEntries(allSectionIds.map((section) => [
    section,
    Object.fromEntries(permissionActions.map((action) => [
      action,
      hasPermission(member, section, action),
    ])),
  ])) as Record<SectionId, Record<PermissionAction, boolean>>;
}
