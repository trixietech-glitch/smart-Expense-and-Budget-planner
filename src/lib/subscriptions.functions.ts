import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Subscription = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billing_cycle: string;
  next_renewal: string | null;
  category: string | null;
  active: boolean;
};

export const listSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Subscription[]> => {
    const { data, error } = await context.supabase
      .from("subscriptions")
      .select("id,name,amount,currency,billing_cycle,next_renewal,category,active")
      .order("next_renewal", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((s) => ({ ...s, amount: Number(s.amount) }));
  });

export const upsertSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(80),
        amount: z.number().min(0),
        currency: z.string().default("KES"),
        billing_cycle: z.enum(["weekly", "monthly", "quarterly", "yearly"]).default("monthly"),
        next_renewal: z.string().optional().nullable(),
        category: z.string().optional().nullable(),
        active: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      user_id: context.userId,
      name: data.name,
      amount: data.amount,
      currency: data.currency,
      billing_cycle: data.billing_cycle,
      next_renewal: data.next_renewal || null,
      category: data.category || null,
      active: data.active,
    };
    const q = data.id
      ? context.supabase.from("subscriptions").update(payload).eq("id", data.id).select().single()
      : context.supabase.from("subscriptions").insert(payload).select().single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return row;
  });

export const toggleSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("subscriptions")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("subscriptions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
