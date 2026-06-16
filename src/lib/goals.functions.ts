import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Goal = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  currency: string;
  target_date: string | null;
  category: string | null;
  created_at: string;
};

export const listGoals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Goal[]> => {
    const { data, error } = await context.supabase
      .from("savings_goals")
      .select("id,name,target_amount,current_amount,currency,target_date,category,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((g) => ({
      ...g,
      target_amount: Number(g.target_amount),
      current_amount: Number(g.current_amount),
    }));
  });

export const upsertGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(80),
        target_amount: z.number().positive().max(1_000_000_000),
        current_amount: z.number().min(0).default(0),
        currency: z.string().default("KES"),
        target_date: z.string().optional().nullable(),
        category: z.string().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      user_id: context.userId,
      name: data.name,
      target_amount: data.target_amount,
      current_amount: data.current_amount,
      currency: data.currency,
      target_date: data.target_date || null,
      category: data.category || null,
    };
    const q = data.id
      ? context.supabase.from("savings_goals").update(payload).eq("id", data.id).select().single()
      : context.supabase.from("savings_goals").insert(payload).select().single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return row;
  });

export const contributeGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), amount: z.number().positive() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: g, error: e1 } = await context.supabase
      .from("savings_goals")
      .select("current_amount")
      .eq("id", data.id)
      .single();
    if (e1) throw new Error(e1.message);
    const next = Number(g.current_amount) + data.amount;
    const { error } = await context.supabase
      .from("savings_goals")
      .update({ current_amount: next })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, current_amount: next };
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("savings_goals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
