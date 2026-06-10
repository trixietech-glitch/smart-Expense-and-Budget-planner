import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const CATEGORIES = [
  "Food & Drink",
  "Transport",
  "Shopping",
  "Bills & Utilities",
  "Groceries",
  "Entertainment",
  "Health",
  "Rent & Housing",
  "Education",
  "Other",
] as const;

const ParsedExpense = z.object({
  amount: z.number().positive(),
  currency: z.string().default("KES"),
  category: z.enum(CATEGORIES),
  description: z.string(),
});

export const logExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ text: z.string().min(2).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);
    const { experimental_output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system:
        "You parse short natural-language expense statements into structured data for a Kenyan personal-finance app. " +
        "Extract the numeric amount, currency (default KES), pick the single best category from the provided list, and a short description (2-6 words). " +
        "If the user mentions M-Pesa, treat the amount as KES. Never invent amounts.",
      prompt: `Parse: "${data.text}"`,
      experimental_output: Output.object({ schema: ParsedExpense }),
    });

    const parsed = experimental_output;

    const { data: row, error } = await context.supabase
      .from("expenses")
      .insert({
        user_id: context.userId,
        amount: parsed.amount,
        currency: parsed.currency || "KES",
        category: parsed.category,
        description: parsed.description,
        raw_text: data.text,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return row;
  });
