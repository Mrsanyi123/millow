import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function loadEnv() {
  const file = join(root, ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function openWaitlist() {
  loadEnv();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env (see .env.example)");

  const table = process.env.SUPABASE_TABLE || "waitlist";
  const emailColumn = process.env.SUPABASE_EMAIL_COLUMN || "email";
  const timeColumn = process.env.SUPABASE_TIME_COLUMN || "timestamp";
  const endpoint = `${url.replace(/\/+$/, "")}/rest/v1/${encodeURIComponent(table)}`;

  // New-style sb_secret_ keys are rejected in the Authorization header; legacy JWT keys need it.
  const headers = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;

  async function request(path, init) {
    const res = await fetch(endpoint + path, { ...init, headers: { ...headers, ...init.headers } });
    if (res.ok) return res;
    const detail = await res.json().catch(() => ({}));
    const error = new Error(`Supabase ${res.status}: ${detail.message || res.statusText}`);
    error.code = detail.code;
    throw error;
  }

  return {
    async add(email) {
      try {
        await request("", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ [emailColumn]: email, [timeColumn]: new Date().toISOString() }),
        });
      } catch (error) {
        if (error.code !== "23505") throw error;
      }
    },

    async list() {
      const select = encodeURIComponent(`${emailColumn},${timeColumn}`);
      const order = encodeURIComponent(`${timeColumn}.asc`);
      const res = await request(`?select=${select}&order=${order}`, { method: "GET" });
      const rows = await res.json();
      return rows.map((row) => ({ email: row[emailColumn], createdAt: row[timeColumn] }));
    },
  };
}
