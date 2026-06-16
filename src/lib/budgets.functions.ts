import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BudgetStatus = {
  id: string;
  category: string;
  monthly_limit: number;
  currency: string;
  spent: number;
  remaining: number;
  pct: number;
  status: "ok" | "warn" | "over";
};

export const listBudgets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BudgetStatus[]> => {
    const { data: budgets, error } = await context.supabase
      .from("budgets")
      .select("id,category,monthly_limit,currency")
      .order("category");
    if (error) throw new Error(error.message);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { data: tx, error: txErr } = await context.supabase
      .from("transactions")
      .select("category,amount,type")
      .eq("type", "expense")
      .gte("spent_at", monthStart.toISOString());
    if (txErr) throw new Error(txErr.message);

    const spentByCat = new Map<string, number>();
    for (const t of tx ?? []) {
      spentByCat.set(t.category, (spentByCat.get(t.category) ?? 0) + Number(t.amount));
    }

    return (budgets ?? []).map((b) => {
      const limit = Number(b.monthly_limit);
      const spent = spentByCat.get(b.category) ?? 0;
      const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      const status: BudgetStatus["status"] = pct >= 100 ? "over" : pct >= 80 ? "warn" : "ok";
      return {
        id: b.id,
        category: b.category,
        monthly_limit: limit,
        currency: b.currency,
        spent,
        remaining: limit - spent,
        pct,
        status,
      };
    });
  });

export const upsertBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        category: z.string().min(1).max(60),
        monthly_limit: z.number().positive().max(100_000_000),
        currency: z.string().default("KES"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("budgets")
      .upsert(
        {
          user_id: context.userId,
          category: data.category,
          monthly_limit: data.monthly_limit,
          currency: data.currency,
        },
        { onConflict: "user_id,category" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("budgets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
