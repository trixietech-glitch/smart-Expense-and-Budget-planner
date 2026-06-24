import process from "node:process";

export type SupabaseEnv = Record<string, string | undefined>;

export function resolveSupabaseEnv(env: SupabaseEnv, kind: "url" | "publishable" | "serviceRole") {
  const source = env ?? process.env;

  if (kind === "url") {
    return source.VITE_SUPABASE_URL || source.SUPABASE_URL || "";
  }

  if (kind === "publishable") {
    return source.VITE_SUPABASE_PUBLISHABLE_KEY || source.SUPABASE_PUBLISHABLE_KEY || "";
  }

  return source.SUPABASE_SERVICE_ROLE_KEY || "";
}
