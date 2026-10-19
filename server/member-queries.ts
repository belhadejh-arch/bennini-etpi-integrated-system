// Use the same projection for account reads and readiness checks. A SELECT 1
// cannot detect missing membership columns or an incorrect pooled search path.
const columns = "clerk_user_id, email, name, role, active, allowed_sections, role_name, permissions, capabilities, language, appearance";
export const memberLookupQuery = `SELECT ${columns} FROM bennini.members WHERE clerk_user_id = $1 AND deleted_at IS NULL`;
export const memberReadinessQuery = `SELECT ${columns}, deleted_at FROM bennini.members LIMIT 0`;
