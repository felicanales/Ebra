import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const numberSchema = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? value : parsed;
    }
    return value;
  },
  z.number().finite()
);

export const nonNegativeNumber = numberSchema.refine((value) => value >= 0, {
  message: "Must be non-negative",
});

export function requirePayload<T>(
  schema: z.ZodType<T>,
  payload: unknown
): { success: true; data: T } | { success: false; error: z.ZodError<T> } {
  const result = schema.safeParse(payload);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
