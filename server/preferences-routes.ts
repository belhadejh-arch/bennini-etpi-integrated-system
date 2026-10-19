import type { Express, RequestHandler } from "express";
import type { Pool } from "pg";
import type { AuthenticatedRequest } from "./index";

export type Language = "ar" | "fr";
export type Appearance = "light" | "dark" | "system";

export function parsePreferences(body: unknown): { language?: Language; appearance?: Appearance } {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("اختر لغة ومظهراً صالحين.");
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some((key) => !["language", "appearance"].includes(key)) ||
      (!Object.hasOwn(input, "language") && !Object.hasOwn(input, "appearance")) ||
      (Object.hasOwn(input, "language") && (typeof input.language !== "string" || !["ar", "fr"].includes(input.language))) ||
      (Object.hasOwn(input, "appearance") && (typeof input.appearance !== "string" || !["light", "dark", "system"].includes(input.appearance)))) {
    throw new Error("اختر لغة ومظهراً صالحين.");
  }
  return input as { language?: Language; appearance?: Appearance };
}

export function registerPreferencesRoutes(app: Express, pool: Pool, authenticate: RequestHandler) {
  app.patch("/api/me/preferences", authenticate, async (req: AuthenticatedRequest, res) => {
    let preferences: ReturnType<typeof parsePreferences>;
    try {
      preferences = parsePreferences(req.body);
    } catch (error) {
      return res.status(400).json({ error: (error as Error).message });
    }
    try {
      // Identity always comes from the authenticated session, never a supplied member ID.
      const result = await pool.query(`
        UPDATE members SET language = COALESCE($1, language),
          appearance = COALESCE($2, appearance), updated_at = NOW()
        WHERE clerk_user_id = $3 AND active = TRUE AND deleted_at IS NULL
        RETURNING clerk_user_id, email, name, role, active, allowed_sections, role_name,
          permissions, capabilities, language, appearance
      `, [preferences.language ?? null, preferences.appearance ?? null, req.member!.clerk_user_id]);
      if (!result.rowCount) return res.status(401).json({ error: "يلزم تسجيل الدخول." });
      res.json({ member: result.rows[0] });
    } catch (error) {
      console.error("Account preference update failed:", error);
      res.status(500).json({ error: "تعذر حفظ تفضيلات الحساب." });
    }
  });
}
