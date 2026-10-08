import { createServer } from "node:http";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const port = Number(process.env.PORT || 4000);
const allowedOrigins = new Set(
  (process.env.FRONTEND_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean),
);
const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const databaseId = process.env.FIREBASE_DATABASE_ID?.trim();

function firebaseApp() {
  const existing = getApps()[0];
  if (existing) return existing;

  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawServiceAccount) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(rawServiceAccount);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must contain valid service-account JSON.");
  }

  return initializeApp({ credential: cert(serviceAccount) });
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 2048) throw new Error("Request body is too large.");
  }
  return body ? JSON.parse(body) : {};
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin?.replace(/\/+$/, "");
  if (origin && !allowedOrigins.has(origin)) {
    sendJson(response, 403, { error: "Origin is not allowed." });
    return;
  }

  if (origin) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method !== "POST" || url.pathname !== "/api/admin/bootstrap") {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  if (!adminEmail || !databaseId || !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    sendJson(response, 503, { error: "Admin provisioning is not configured." });
    return;
  }

  try {
    await readJson(request);
  } catch {
    sendJson(response, 400, { error: "Invalid request body." });
    return;
  }

  const authorization = request.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    sendJson(response, 401, { error: "Authentication is required." });
    return;
  }

  let app;
  try {
    app = firebaseApp();
  } catch (error) {
    console.error("Firebase Admin SDK configuration failed:", error);
    sendJson(response, 503, { error: "Firebase Admin SDK is not configured correctly." });
    return;
  }

  const firebaseAuth = getAuth(app);
  let decodedToken;
  try {
    decodedToken = await firebaseAuth.verifyIdToken(match[1]);
  } catch {
    sendJson(response, 401, { error: "Could not verify this Firebase account." });
    return;
  }
  const email = decodedToken.email?.trim().toLowerCase();

  if (!decodedToken.email_verified || email !== adminEmail) {
    if (decodedToken.role === "admin") {
      try {
        const user = await firebaseAuth.getUser(decodedToken.uid);
        const { role: _oldRole, ...otherClaims } = user.customClaims || {};
        await firebaseAuth.setCustomUserClaims(decodedToken.uid, otherClaims);
      } catch (error) {
        console.error("Could not remove an outdated administrator role:", error);
        sendJson(response, 500, { error: "Could not update this Firebase account." });
        return;
      }
    }
    sendJson(response, 403, { error: "This Google account is not authorized as an administrator." });
    return;
  }

  try {
    const user = await firebaseAuth.getUser(decodedToken.uid);
    const customClaims = { ...user.customClaims, role: "admin" };
    await firebaseAuth.setCustomUserClaims(decodedToken.uid, customClaims);

    const profile = {
      id: decodedToken.uid,
      uid: decodedToken.uid,
      name: user.displayName || email,
      email,
      role: "المدير العام / المدير",
      accountCategory: "manager",
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
      createdAt: new Date().toISOString(),
    };
    await getFirestore(app, databaseId)
      .collection("userProfiles")
      .doc(decodedToken.uid)
      .set(profile, { merge: true });

    sendJson(response, 200, { isAdmin: true });
  } catch (error) {
    console.error("Admin bootstrap failed:", error);
    sendJson(response, 401, { error: "Could not verify this Firebase account." });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Firebase admin API listening on port ${port}`);
});
