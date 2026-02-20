import { z } from "zod";
import { nonNegativeNumber } from "./common";

export const inputCreateSchema = z.object({
  sku: z.string().min(1).optional(),
  name: z.string().min(1),
  unit: z.string().min(1),
  is_critical: z.boolean().optional(),
  reorder_point: nonNegativeNumber.optional(),
  active: z.boolean().optional(),
});

export const inputUpdateSchema = z
  .object({
    sku: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    unit: z.string().min(1).optional(),
    is_critical: z.boolean().optional(),
    reorder_point: nonNegativeNumber.optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const inputCostCreateSchema = z.object({
  cost_per_unit: nonNegativeNumber,
  currency: z.string().min(1).optional(),
  valid_from: z.string().min(1).optional(),
});
