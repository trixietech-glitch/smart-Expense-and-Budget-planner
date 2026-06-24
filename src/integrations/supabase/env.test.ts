import test from "node:test";
import assert from "node:assert/strict";
import { resolveSupabaseEnv } from "./env.ts";

test("resolves Supabase config from VITE-prefixed variables", () => {
  const env = {
    VITE_SUPABASE_URL: "https://example.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY: "anon-key",
  };

  assert.equal(resolveSupabaseEnv(env, "url"), "https://example.supabase.co");
  assert.equal(resolveSupabaseEnv(env, "publishable"), "anon-key");
});

test("falls back to legacy non-prefixed variables", () => {
  const env = {
    SUPABASE_URL: "https://legacy.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "legacy-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  };

  assert.equal(resolveSupabaseEnv(env, "url"), "https://legacy.supabase.co");
  assert.equal(resolveSupabaseEnv(env, "publishable"), "legacy-anon-key");
  assert.equal(resolveSupabaseEnv(env, "serviceRole"), "service-role-key");
});
