import { Request, Response } from "express";
import { pool } from "../db";
import {
  bomUpsertSchema,
  productCreateSchema,
  productUpdateSchema,
} from "../validation/products";
import { requirePayload } from "../validation/common";
import { respondValidationError } from "../validation/handler";

export async function getProducts(req: Request, res: Response) {
  const onlyActive = req.query.active !== "false";
  const result = await pool.query(
    `
    SELECT id, sku, name, description, photo_url, active, created_at
    FROM products
    WHERE ($1::boolean IS FALSE OR active = true)
    ORDER BY created_at DESC
    `,
    [onlyActive]
  );

  return res.json(result.rows);
}

export async function createProduct(req: Request, res: Response) {
  const parsed = requirePayload(productCreateSchema, req.body);
  if (!parsed.success) {
    return respondValidationError(res, parsed.error);
  }

  const { sku, name, description, photo_url, active } = parsed.data;
  const result = await pool.query(
    `
    INSERT INTO products (sku, name, description, photo_url, active)
    VALUES ($1, $2, $3, $4, COALESCE($5, true))
    RETURNING id, sku, name, description, photo_url, active, created_at
    `,
    [sku ?? null, name, description ?? null, photo_url ?? null, active ?? true]
  );

  return res.status(201).json(result.rows[0]);
}

export async function updateProduct(req: Request, res: Response) {
  const parsed = requirePayload(productUpdateSchema, req.body);
  if (!parsed.success) {
    return respondValidationError(res, parsed.error);
  }

  const updates: Record<string, unknown> = {};
  const data = parsed.data;

  if (data.sku !== undefined) updates.sku = data.sku;
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.photo_url !== undefined) updates.photo_url = data.photo_url;
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
    UPDATE products
    SET ${setClause}
    WHERE id = $${values.length}
    RETURNING id, sku, name, description, photo_url, active, created_at
    `,
    values
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: "Product not found" });
  }

  return res.json(result.rows[0]);
}

export async function deleteProduct(req: Request, res: Response) {
  const result = await pool.query(
    `
    UPDATE products
    SET active = false
    WHERE id = $1
    RETURNING id, sku, name, description, photo_url, active, created_at
    `,
    [req.params.id]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: "Product not found" });
  }

  return res.json(result.rows[0]);
}

export async function upsertBom(req: Request, res: Response) {
  const parsed = requirePayload(bomUpsertSchema, req.body);
  if (!parsed.success) {
    return respondValidationError(res, parsed.error);
  }

  const productId = req.params.id;
  const items = parsed.data.items;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const productExists = await client.query(
      "SELECT id FROM products WHERE id = $1",
      [productId]
    );
    if (productExists.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Product not found" });
    }

    await client.query("DELETE FROM product_bom WHERE product_id = $1", [
      productId,
    ]);

    for (const item of items) {
      await client.query(
        `
        INSERT INTO product_bom (
          product_id,
          input_id,
          quantity_per_unit,
          wastage_rate,
          notes
        )
        VALUES ($1, $2, $3, COALESCE($4, 0), $5)
        `,
        [
          productId,
          item.input_id,
          item.quantity_per_unit,
          item.wastage_rate ?? 0,
          item.notes ?? null,
        ]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const bomResult = await pool.query(
    `
    SELECT id, product_id, input_id, quantity_per_unit, wastage_rate, notes
    FROM product_bom
    WHERE product_id = $1
    ORDER BY created_at DESC
    `,
    [productId]
  );

  return res.status(200).json({ product_id: productId, items: bomResult.rows });
}

export async function getProductFull(req: Request, res: Response) {
  const productId = req.params.id;
  const productResult = await pool.query(
    `
    SELECT id, sku, name, description, photo_url, active, created_at
    FROM products
    WHERE id = $1
    `,
    [productId]
  );

  if (productResult.rowCount === 0) {
    return res.status(404).json({ error: "Product not found" });
  }

  const bomResult = await pool.query(
    `
    SELECT
      pb.id,
      pb.product_id,
      pb.input_id,
      pb.quantity_per_unit,
      pb.wastage_rate,
      pb.notes,
      i.sku AS input_sku,
      i.name AS input_name,
      i.unit AS input_unit,
      ic.cost_per_unit,
      ic.currency,
      ic.valid_from
    FROM product_bom pb
    JOIN inputs i ON i.id = pb.input_id
    LEFT JOIN LATERAL (
      SELECT cost_per_unit, currency, valid_from
      FROM input_costs
      WHERE input_id = i.id
      ORDER BY valid_from DESC, created_at DESC
      LIMIT 1
    ) ic ON true
    WHERE pb.product_id = $1
    ORDER BY i.name
    `,
    [productId]
  );

  return res.json({
    product: productResult.rows[0],
    bom: bomResult.rows,
  });
}
