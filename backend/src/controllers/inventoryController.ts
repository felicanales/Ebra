import { Request, Response } from "express";
import { pool } from "../db";
import { inventoryMovementSchema } from "../validation/inventory";
import { requirePayload } from "../validation/common";
import { respondValidationError } from "../validation/handler";

export async function createMovement(req: Request, res: Response) {
  const parsed = requirePayload(inventoryMovementSchema, req.body);
  if (!parsed.success) {
    return respondValidationError(res, parsed.error);
  }

  const { item_type, item_id, location_id, qty, reason, reference_text } =
    parsed.data;

  const result = await pool.query(
    `
    INSERT INTO inventory_movements (
      item_type,
      item_id,
      location_id,
      qty,
      reason,
      reference_text
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, item_type, item_id, location_id, qty, reason, reference_text, created_at
    `,
    [
      item_type,
      item_id,
      location_id ?? null,
      qty,
      reason,
      reference_text ?? null,
    ]
  );

  return res.status(201).json(result.rows[0]);
}

export async function getInventorySummary(req: Request, res: Response) {
  const result = await pool.query(
    `
    SELECT item_type, item_id, SUM(qty) AS stock
    FROM inventory_movements
    GROUP BY item_type, item_id
    ORDER BY item_type, item_id
    `
  );

  return res.json(result.rows);
}
