import { Request, Response } from "express";
import { pool } from "../db";
import {
  inputCostCreateSchema,
  inputCreateSchema,
  inputUpdateSchema,
} from "../validation/inputs";
import { requirePayload } from "../validation/common";
import { respondValidationError } from "../validation/handler";

export async function getInputs(req: Request, res: Response) {
  const onlyActive = req.query.active !== "false";
  const result = await pool.query(
    `
    SELECT id, sku, name, unit, is_critical, reorder_point, active, created_at
    FROM inputs
    WHERE ($1::boolean IS FALSE OR active = true)
    ORDER BY created_at DESC
    `,
    [onlyActive]
  );

  return res.json(result.rows);
}

export async function createInput(req: Request, res: Response) {
  const parsed = requirePayload(inputCreateSchema, req.body);
  if (!parsed.success) {
    return respondValidationError(res, parsed.error);
  }

  const { sku, name, unit, is_critical, reorder_point, active } = parsed.data;
  const result = await pool.query(
    `
    INSERT INTO inputs (sku, name, unit, is_critical, reorder_point, active)
    VALUES ($1, $2, $3, $4, $5, COALESCE($6, true))
    RETURNING id, sku, name, unit, is_critical, reorder_point, active, created_at
    `,
    [
      sku ?? null,
      name,
      unit,
      is_critical ?? false,
      reorder_point ?? 0,
      active ?? true,
    ]
  );

  return res.status(201).json(result.rows[0]);
}

export async function updateInput(req: Request, res: Response) {
  const parsed = requirePayload(inputUpdateSchema, req.body);
  if (!parsed.success) {
    return respondValidationError(res, parsed.error);
  }

  const updates: Record<string, unknown> = {};
  const data = parsed.data;

  if (data.sku !== undefined) updates.sku = data.sku;
  if (data.name !== undefined) updates.name = data.name;
  if (data.unit !== undefined) updates.unit = data.unit;
  if (data.is_critical !== undefined) updates.is_critical = data.is_critical;
  if (data.reorder_point !== undefined) updates.reorder_point = data.reorder_point;
  if (data.active !== undefined) updates.active = data.active;

  const keys = Object.keys(updates);
  if (keys.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  const setClause = keys.map((key, idx) => `${key} = $${idx + 1}`).join(", ");
  const values = keys.map((key) => updates[key]);
  values.push(req.params.id);

  const result = await pool.query(
    `
    UPDATE inputs
    SET ${setClause}
    WHERE id = $${values.length}
    RETURNING id, sku, name, unit, is_critical, reorder_point, active, created_at
    `,
    values
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: "Input not found" });
  }

  return res.json(result.rows[0]);
}

export async function deleteInput(req: Request, res: Response) {
  const result = await pool.query(
    `
    UPDATE inputs
    SET active = false
    WHERE id = $1
    RETURNING id, sku, name, unit, is_critical, reorder_point, active, created_at
    `,
    [req.params.id]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: "Input not found" });
  }

  return res.json(result.rows[0]);
}

export async function addInputCost(req: Request, res: Response) {
  const parsed = requirePayload(inputCostCreateSchema, req.body);
  if (!parsed.success) {
    return respondValidationError(res, parsed.error);
  }

  const { cost_per_unit, currency, valid_from } = parsed.data;

  const result = await pool.query(
    `
    INSERT INTO input_costs (input_id, cost_per_unit, currency, valid_from)
    VALUES ($1, $2, COALESCE($3, 'CLP'), COALESCE($4::timestamptz, now()))
    RETURNING id, input_id, cost_per_unit, currency, valid_from, created_at
    `,
    [req.params.id, cost_per_unit, currency ?? null, valid_from ?? null]
  );

  return res.status(201).json(result.rows[0]);
}
