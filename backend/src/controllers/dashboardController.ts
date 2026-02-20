import { Request, Response } from "express";
import { pool } from "../db";

export async function getDashboardKpis(req: Request, res: Response) {
  const [productsResult, inputsResult] = await Promise.all([
    pool.query("SELECT COUNT(*) FROM products WHERE active = true"),
    pool.query("SELECT COUNT(*) FROM inputs WHERE active = true"),
  ]);

  const criticalResult = await pool.query(
    `
    WITH stock AS (
      SELECT item_id, SUM(qty) AS qty
      FROM inventory_movements
      WHERE item_type = 'input'
      GROUP BY item_id
    )
    SELECT
      i.id,
      i.sku,
      i.name,
      i.reorder_point,
      COALESCE(s.qty, 0) AS stock
    FROM inputs i
    LEFT JOIN stock s ON s.item_id = i.id
    WHERE i.is_critical = true
      AND i.active = true
      AND COALESCE(s.qty, 0) <= i.reorder_point
    ORDER BY COALESCE(s.qty, 0) ASC
    `
  );

  const adCostResult = await pool.query(
    `
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM ad_costs
    WHERE period_end >= (CURRENT_DATE - INTERVAL '30 days')
    `
  );

  const topProductsResult = await pool.query(
    `
    SELECT
      p.id,
      p.sku,
      p.name,
      COALESCE(SUM(
        pb.quantity_per_unit * (1 + pb.wastage_rate) * COALESCE(ic.cost_per_unit, 0)
      ), 0) AS material_cost
    FROM products p
    LEFT JOIN product_bom pb ON pb.product_id = p.id
    LEFT JOIN inputs i ON i.id = pb.input_id
    LEFT JOIN LATERAL (
      SELECT cost_per_unit
      FROM input_costs
      WHERE input_id = i.id
      ORDER BY valid_from DESC, created_at DESC
      LIMIT 1
    ) ic ON true
    WHERE p.active = true
    GROUP BY p.id, p.sku, p.name
    ORDER BY material_cost DESC
    LIMIT 5
    `
  );

  return res.json({
    total_active_products: Number(productsResult.rows[0].count),
    total_active_inputs: Number(inputsResult.rows[0].count),
    critical_inputs_below_reorder: criticalResult.rows.map((row) => ({
      id: row.id,
      sku: row.sku,
      name: row.name,
      reorder_point: Number(row.reorder_point),
      stock: Number(row.stock),
    })),
    ad_cost_last_30_days: Number(adCostResult.rows[0].total),
    top_products_by_material_cost: topProductsResult.rows.map((row) => ({
      id: row.id,
      sku: row.sku,
      name: row.name,
      material_cost: Number(row.material_cost),
    })),
  });
}
