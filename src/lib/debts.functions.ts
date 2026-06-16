import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Debt = {
  id: string;
  name: string;
  lender: string | null;
  principal: number;
  balance: number;
  interest_rate: number;
  minimum_payment: number;
  due_day: number | null;
  currency: string;
  status: string;
};

export const listDebts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Debt[]> => {
    const { data, error } = await context.supabase
      .from("debts")
      .select("id,name,lender,principal,balance,interest_rate,minimum_payment,due_day,currency,status")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((d) => ({
      ...d,
      principal: Number(d.principal),
      balance: Number(d.balance),
      interest_rate: Number(d.interest_rate),
      minimum_payment: Number(d.minimum_payment),
    }));
  });

export const upsertDebt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(80),
        lender: z.string().max(80).optional().nullable(),
        principal: z.number().min(0),
        balance: z.number().min(0),
        interest_rate: z.number().min(0).max(1000).default(0),
        minimum_payment: z.number().min(0).default(0),
        due_day: z.number().int().min(1).max(31).optional().nullable(),
        currency: z.string().default("KES"),
        status: z.enum(["active", "paid"]).default("active"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      user_id: context.userId,
      name: data.name,
      lender: data.lender || null,
      principal: data.principal,
      balance: data.balance,
      interest_rate: data.interest_rate,
      minimum_payment: data.minimum_payment,
      due_day: data.due_day ?? null,
      currency: data.currency,
      status: data.status,
    };
    const q = data.id
      ? context.supabase.from("debts").update(payload).eq("id", data.id).select().single()
      : context.supabase.from("debts").insert(payload).select().single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return row;
  });

export const payDebt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), amount: z.number().positive() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: d, error: e1 } = await context.supabase
      .from("debts")
      .select("balance")
      .eq("id", data.id)
      .single();
    if (e1) throw new Error(e1.message);
    const next = Math.max(0, Number(d.balance) - data.amount);
    const { error } = await context.supabase
      .from("debts")
      .update({ balance: next, status: next === 0 ? "paid" : "active" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, balance: next };
  });

export const deleteDebt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("debts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
