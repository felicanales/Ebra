import { z } from "zod";
import { nonNegativeNumber, numberSchema, uuidSchema } from "./common";

export const productCreateSchema = z.object({
  sku: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  photo_url: z.string().url().optional(),
  active: z.boolean().optional(),
});

export const productUpdateSchema = z
  .object({
    sku: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    photo_url: z.string().url().optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

const wastageRateSchema = numberSchema.refine(
  (value) => value >= 0 && value <= 1,
  {
    message: "Wastage rate must be between 0 and 1",
  }
);

export const bomUpsertSchema = z.object({
  items: z
    .array(
      z.object({
        input_id: uuidSchema,
        quantity_per_unit: nonNegativeNumber,
        wastage_rate: wastageRateSchema.optional(),
        notes: z.string().optional(),
      })
    )
    .min(1),
});
