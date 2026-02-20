import { z } from "zod";
import { numberSchema, uuidSchema } from "./common";

export const inventoryMovementSchema = z.object({
  item_type: z.enum(["input", "product"]),
  item_id: uuidSchema,
  location_id: uuidSchema.optional(),
  qty: numberSchema.refine((value) => value !== 0, {
    message: "Quantity cannot be zero",
  }),
  reason: z.enum([
    "purchase",
    "sale",
    "production_consume",
    "adjustment",
    "wastage",
  ]),
  reference_text: z.string().optional(),
});
