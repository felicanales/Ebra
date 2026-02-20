import { Request, Response } from "express";
import { pool } from "../db";

export async function getProductCosting(req: Request, res: Response) {
  const productId = req.params.id;

  const productResult = await pool.query(
    "SELECT id, sku, name FROM products WHERE id = $1",
    [productId]
  );
  if (productResult.rowCount === 0) {
    return res.status(404).json({ error: "Product not found" });
  }

  const materialResult = await pool.query(
    `
    SELECT
      pb.input_id,
      i.sku AS input_sku,
      i.name AS input_name,
      i.unit AS input_unit,
      pb.quantity_per_unit,
      pb.wastage_rate,
      ic.cost_per_unit,
      ic.currency,
      (pb.quantity_per_unit * (1 + pb.wastage_rate) * COALESCE(ic.cost_per_unit, 0)) AS line_cost
    FROM product_bom pb
    JOIN inputs i ON i.id = pb.input_id
    LEFT JOIN LATERAL (
      SELECT cost_per_unit, currency
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

  const materials = materialResult.rows.map((row) => ({
    input_id: row.input_id,
    sku: row.input_sku,
    name: row.input_name,
    unit: row.input_unit,
    quantity_per_unit: Number(row.quantity_per_unit),
    wastage_rate: Number(row.wastage_rate),
    cost_per_unit: row.cost_per_unit !== null ? Number(row.cost_per_unit) : null,
    currency: row.currency ?? "CLP",
    line_cost: Number(row.line_cost),
  }));

  const materialCost = materials.reduce(
    (sum, item) => sum + (Number.isFinite(item.line_cost) ? item.line_cost : 0),
    0
  );

  const adCostResult = await pool.query(
    `
    SELECT
      ac.id,
      ac.campaign_name,
      ac.social_network,
      ac.campaign_start,
      ac.campaign_end,
      ac.amount,
      ac.notes,
      COALESCE(pb.total_produced, 0) AS total_produced
    FROM ad_costs ac
    LEFT JOIN LATERAL (
      SELECT SUM(quantity_produced) AS total_produced
      FROM production_batches
      WHERE product_id = ac.product_id
        AND created_at::date BETWEEN ac.campaign_start AND ac.campaign_end
    ) pb ON true
    WHERE ac.product_id = $1
    ORDER BY ac.campaign_start DESC
    `,
    [productId]
  );

  const adCosts = adCostResult.rows.map((row) => {
    const amount = Number(row.amount);
    const totalProduced = Number(row.total_produced) || 0;
    const allocatedPerUnit = totalProduced > 0 ? amount / totalProduced : amount;

    return {
      id: row.id,
      campaign_name: row.campaign_name,
      social_network: row.social_network,
      campaign_start: row.campaign_start,
      campaign_end: row.campaign_end,
      amount,
      total_produced: totalProduced,
      allocated_per_unit: allocatedPerUnit,
      notes: row.notes,
    };
  });

  const adAllocatedCost = adCosts.reduce(
    (sum, item) => sum + item.allocated_per_unit,
    0
  );

  const totalCost = materialCost + adAllocatedCost;

  return res.json({
    product: productResult.rows[0],
    material_cost: materialCost,
    ad_allocated_cost: adAllocatedCost,
    total_cost: totalCost,
    materials_breakdown: materials,
    ad_costs: adCosts,
  });
}
