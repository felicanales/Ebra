import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

type InputItem = {
  id: string;
  sku: string | null;
  name: string;
  unit: string;
  is_critical: boolean;
  reorder_point: number;
  active: boolean;
  created_at: string;
  cost_per_unit?: number | null;
  currency?: string | null;
  valid_from?: string | null;
};

type Product = {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  photo_url: string | null;
  active: boolean;
  created_at: string;
};

type ProductBomRow = {
  id: string;
  product_id: string;
  input_id: string;
  quantity_per_unit: number;
  wastage_rate: number;
  notes: string | null;
  input_sku: string | null;
  input_name: string;
  input_unit: string;
  cost_per_unit: number | null;
  currency: string | null;
};

type ProductFull = {
  product: Product;
  bom: ProductBomRow[];
};

type MaterialBreakdown = {
  input_id: string;
  sku: string | null;
  name: string;
  unit: string;
  quantity_per_unit: number;
  wastage_rate: number;
  cost_per_unit: number | null;
  currency: string;
  line_cost: number;
};

type Costing = {
  material_cost: number;
  ad_allocated_cost: number;
  total_cost: number;
  materials_breakdown: MaterialBreakdown[];
  ad_costs: Array<{
    id: string;
    campaign_name: string;
    social_network: string;
    campaign_start: string;
    campaign_end: string;
    amount: number;
    total_produced: number;
    allocated_per_unit: number;
    notes: string | null;
  }>;
};

type BomDraftRow = {
  input_id: string;
  quantity_per_unit: string;
  wastage_rate: string;
  notes: string;
};

const clpFormatter = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCLP(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  return clpFormatter.format(value);
}

function buildLocalCosting(detail: ProductFull): Costing {
  const materials = detail.bom.map((row) => {
    const costPerUnit = row.cost_per_unit ?? 0;
    const wastage = row.wastage_rate ?? 0;
    const lineCost = Number(row.quantity_per_unit) * (1 + wastage) * costPerUnit;

    return {
      input_id: row.input_id,
      sku: row.input_sku ?? null,
      name: row.input_name,
      unit: row.input_unit,
      quantity_per_unit: Number(row.quantity_per_unit),
      wastage_rate: Number(wastage),
      cost_per_unit: row.cost_per_unit,
      currency: row.currency ?? "CLP",
      line_cost: Number.isFinite(lineCost) ? lineCost : 0,
    };
  });

  const materialCost = materials.reduce((sum, item) => sum + item.line_cost, 0);

  return {
    material_cost: materialCost,
    ad_allocated_cost: 0,
    total_cost: materialCost,
    materials_breakdown: materials,
    ad_costs: [],
  };
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }

  return response.json() as Promise<T>;
}

function App() {
  const [tab, setTab] = useState<"inputs" | "products">("inputs");
  const [inputs, setInputs] = useState<InputItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productFull, setProductFull] = useState<ProductFull | null>(null);
  const [productCosting, setProductCosting] = useState<Costing | null>(null);
  const [status, setStatus] = useState<string>("");
  const [productCache, setProductCache] = useState<Record<string, ProductFull>>(
    {}
  );

  const [inputForm, setInputForm] = useState({
    name: "",
    unit: "g",
    reorder_point: "0",
    cost_per_unit: "",
  });
  const [editingInputId, setEditingInputId] = useState<string | null>(null);

  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    photo_url: "",
  });
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const [bomDraft, setBomDraft] = useState<BomDraftRow[]>([]);

  useEffect(() => {
    void refreshAll();
  }, []);

  async function refreshAll() {
    try {
      setStatus("Actualizando datos...");
      const [inputsData, productsData] = await Promise.all([
        api<InputItem[]>("/inputs"),
        api<Product[]>("/products"),
      ]);
      setInputs(inputsData);
      setProducts(productsData);
      setStatus("Datos actualizados.");
      setTimeout(() => setStatus(""), 2000);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Error actualizando");
    }
  }

  async function loadProductDetail(productId: string) {
    try {
      const detail = await api<ProductFull>(`/products/${productId}/full`);
      setProductCache((prev) => ({ ...prev, [productId]: detail }));
      setProductFull(detail);
      setBomDraft(
        detail.bom.map((row) => ({
          input_id: row.input_id,
          quantity_per_unit: String(row.quantity_per_unit),
          wastage_rate: String(row.wastage_rate ?? 0),
          notes: row.notes ?? "",
        }))
      );
      setProductCosting(buildLocalCosting(detail));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Error cargando producto");
    }
  }

  function resetInputForm() {
    setInputForm({
      name: "",
      unit: "g",
      reorder_point: "0",
      cost_per_unit: "",
    });
    setEditingInputId(null);
  }

  async function handleInputSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const payload = {
        name: inputForm.name.trim(),
        unit: inputForm.unit.trim(),
        reorder_point: Number(inputForm.reorder_point || 0),
      };

      let inputId = editingInputId;
      let updatedInput: InputItem | null = null;
      if (editingInputId) {
        const updated = await api<InputItem>(`/inputs/${editingInputId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        updatedInput = updated;
      } else {
        const created = await api<InputItem>("/inputs", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        inputId = created.id;
        updatedInput = created;
      }

      let costPatch: Partial<InputItem> = {};
      if (inputId && inputForm.cost_per_unit.trim()) {
        const cost = await api<{
          cost_per_unit: number;
          currency: string;
          valid_from: string;
        }>(`/inputs/${inputId}/cost`, {
          method: "POST",
          body: JSON.stringify({
            cost_per_unit: Number(inputForm.cost_per_unit),
          }),
        });
        costPatch = {
          cost_per_unit: Number(cost.cost_per_unit),
          currency: cost.currency ?? "CLP",
          valid_from: cost.valid_from,
        };
      }

      if (updatedInput) {
        const mergedInput = { ...updatedInput, ...costPatch };
        setInputs((prev) => {
          if (editingInputId) {
            return prev.map((item) =>
              item.id === updatedInput!.id
                ? { ...item, ...mergedInput }
                : item
            );
          }
          return [mergedInput, ...prev];
        });
        setProductFull((prev) => {
          if (!prev) return prev;
          const updatedBom = prev.bom.map((row) =>
            row.input_id === mergedInput.id
              ? {
                  ...row,
                  cost_per_unit:
                    mergedInput.cost_per_unit ?? row.cost_per_unit ?? null,
                  currency: mergedInput.currency ?? row.currency ?? "CLP",
                }
              : row
          );
          const updatedDetail = { ...prev, bom: updatedBom };
          setProductCosting(buildLocalCosting(updatedDetail));
          return updatedDetail;
        });
        setProductCache((prev) => {
          const next: Record<string, ProductFull> = {};
          let changed = false;
          for (const [productId, detail] of Object.entries(prev)) {
            let touched = false;
            const updatedBom = detail.bom.map((row) => {
              if (row.input_id !== mergedInput.id) {
                return row;
              }
              touched = true;
              return {
                ...row,
                cost_per_unit:
                  mergedInput.cost_per_unit ?? row.cost_per_unit ?? null,
                currency: mergedInput.currency ?? row.currency ?? "CLP",
              };
            });
            if (touched) {
              changed = true;
              next[productId] = { ...detail, bom: updatedBom };
            } else {
              next[productId] = detail;
            }
          }
          return changed ? next : prev;
        });
      }

      resetInputForm();
      setStatus("Insumo guardado.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Error guardando insumo");
    }
  }

  function startEditInput(input: InputItem) {
    setEditingInputId(input.id);
    setInputForm({
      name: input.name,
      unit: input.unit,
      reorder_point: String(input.reorder_point ?? 0),
      cost_per_unit: "",
    });
  }

  async function handleDeleteInput(inputId: string) {
    if (!window.confirm("Eliminar este insumo?")) return;
    try {
      await api(`/inputs/${inputId}`, { method: "DELETE" });
      setInputs((prev) => prev.filter((input) => input.id !== inputId));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Error eliminando insumo");
    }
  }

  function resetProductForm() {
    setProductForm({
      name: "",
      description: "",
      photo_url: "",
    });
    setEditingProductId(null);
  }

  async function handleProductSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const payload = {
        name: productForm.name.trim(),
        description: productForm.description.trim() || undefined,
        photo_url: productForm.photo_url.trim() || undefined,
      };

      let updatedProduct: Product | null = null;
      if (editingProductId) {
        const updated = await api<Product>(`/products/${editingProductId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        updatedProduct = updated;
      } else {
        const created = await api<Product>("/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        updatedProduct = created;
      }

      if (updatedProduct) {
        setProducts((prev) => {
          if (editingProductId) {
            return prev.map((item) =>
              item.id === updatedProduct!.id ? { ...item, ...updatedProduct } : item
            );
          }
          return [updatedProduct, ...prev];
        });
        setProductCache((prev) => {
          const cached = prev[updatedProduct!.id];
          if (!cached) return prev;
          return {
            ...prev,
            [updatedProduct!.id]: {
              ...cached,
              product: { ...cached.product, ...updatedProduct },
            },
          };
        });
        if (selectedProductId === updatedProduct.id) {
          setProductFull((prev) =>
            prev ? { ...prev, product: { ...prev.product, ...updatedProduct } } : prev
          );
        }
      }

      resetProductForm();
      setStatus("Producto guardado.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Error guardando producto");
    }
  }

  function startEditProduct(product: Product) {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      description: product.description ?? "",
      photo_url: product.photo_url ?? "",
    });
  }

  async function handleDeleteProduct(productId: string) {
    if (!window.confirm("Eliminar este producto?")) return;
    try {
      await api(`/products/${productId}`, { method: "DELETE" });
      setProducts((prev) => prev.filter((product) => product.id !== productId));
      setProductCache((prev) => {
        if (!prev[productId]) return prev;
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      if (selectedProductId === productId) {
        setSelectedProductId(null);
        setProductFull(null);
        setProductCosting(null);
        setBomDraft([]);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Error eliminando producto");
    }
  }

  async function handleSelectProduct(productId: string) {
    if (selectedProductId === productId && productFull) {
      return;
    }
    const cached = productCache[productId];
    if (cached) {
      setSelectedProductId(productId);
      setProductFull(cached);
      setBomDraft(
        cached.bom.map((row) => ({
          input_id: row.input_id,
          quantity_per_unit: String(row.quantity_per_unit),
          wastage_rate: String(row.wastage_rate ?? 0),
          notes: row.notes ?? "",
        }))
      );
      setProductCosting(buildLocalCosting(cached));
      return;
    }
    setSelectedProductId(productId);
    await loadProductDetail(productId);
  }

  function updateBomRow(index: number, patch: Partial<BomDraftRow>) {
    setBomDraft((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row))
    );
  }

  function addBomRow() {
    setBomDraft((prev) => [
      ...prev,
      { input_id: "", quantity_per_unit: "", wastage_rate: "0", notes: "" },
    ]);
  }

  function removeBomRow(index: number) {
    setBomDraft((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function saveBom() {
    if (!selectedProductId) return;
    try {
      const items = bomDraft
        .filter((row) => row.input_id)
        .map((row) => ({
          input_id: row.input_id,
          quantity_per_unit: Number(row.quantity_per_unit || 0),
          wastage_rate: row.wastage_rate ? Number(row.wastage_rate) : 0,
          notes: row.notes.trim() || undefined,
        }));

      await api(`/products/${selectedProductId}/bom`, {
        method: "POST",
        body: JSON.stringify({ items }),
      });

      const inputMap = new Map(inputs.map((input) => [input.id, input]));
      const nextBom: ProductBomRow[] = items.map((row, index) => {
        const input = inputMap.get(row.input_id);
        return {
          id: `${row.input_id}-${index}`,
          product_id: selectedProductId,
          input_id: row.input_id,
          quantity_per_unit: row.quantity_per_unit,
          wastage_rate: row.wastage_rate ?? 0,
          notes: row.notes ?? null,
          input_sku: input?.sku ?? null,
          input_name: input?.name ?? "Insumo",
          input_unit: input?.unit ?? "-",
          cost_per_unit: input?.cost_per_unit ?? null,
          currency: input?.currency ?? "CLP",
        };
      });
      setProductFull((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, bom: nextBom };
        setProductCosting(buildLocalCosting(updated));
        return updated;
      });
      setProductCache((prev) => {
        if (!prev[selectedProductId]) return prev;
        return {
          ...prev,
          [selectedProductId]: {
            ...prev[selectedProductId],
            bom: nextBom,
          },
        };
      });
      setStatus("BOM actualizado.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Error guardando BOM");
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Atelier de Costos</p>
          <h1>Control total de insumos y productos</h1>
          <p className="subtitle">
            Ajusta costos por gramo o unidad, gestiona tus carteras y visualiza el
            impacto inmediato.
          </p>
        </div>
        <div className="top-actions">
          <button className="btn ghost" onClick={refreshAll}>
            Refrescar
          </button>
          <span className="status">{status}</span>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <button
            className={`nav-btn ${tab === "inputs" ? "active" : ""}`}
            onClick={() => setTab("inputs")}
          >
            Insumos
          </button>
          <button
            className={`nav-btn ${tab === "products" ? "active" : ""}`}
            onClick={() => setTab("products")}
          >
            Productos
          </button>
          <div className="sidebar-card">
            <p className="label">Resumen rapido</p>
            <p>
              <strong>{inputs.length}</strong> insumos activos
            </p>
            <p>
              <strong>{products.length}</strong> productos activos
            </p>
          </div>
        </aside>

        <main className="content">
          {tab === "inputs" ? (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>Gestion de Insumos</h2>
                  <p>
                    Crea, edita y registra el costo actual segun unidad (g,
                    unidad, ml, etc.).
                  </p>
                </div>
              </div>

              <form className="form-grid" onSubmit={handleInputSubmit}>
                <div className="field">
                  <label>Nombre</label>
                  <input
                    value={inputForm.name}
                    onChange={(event) =>
                      setInputForm({ ...inputForm, name: event.target.value })
                    }
                    placeholder="Lana merino"
                    required
                  />
                </div>
                <div className="field">
                  <label>Unidad</label>
                  <input
                    value={inputForm.unit}
                    onChange={(event) =>
                      setInputForm({ ...inputForm, unit: event.target.value })
                    }
                    placeholder="g / unidad / ml"
                    required
                  />
                </div>
                <div className="field">
                  <label>Punto de reposicion</label>
                  <input
                    type="number"
                    value={inputForm.reorder_point}
                    onChange={(event) =>
                      setInputForm({
                        ...inputForm,
                        reorder_point: event.target.value,
                      })
                    }
                    min="0"
                  />
                </div>
                <div className="field">
                  <label>Costo actual (CLP)</label>
                  <input
                    type="number"
                    value={inputForm.cost_per_unit}
                    onChange={(event) =>
                      setInputForm({
                        ...inputForm,
                        cost_per_unit: event.target.value,
                      })
                    }
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div className="actions">
                  <button className="btn primary" type="submit">
                    {editingInputId ? "Actualizar" : "Crear insumo"}
                  </button>
                  {editingInputId && (
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={resetInputForm}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>

              <div className="grid">
                {inputs.map((input) => (
                  <article className="card" key={input.id}>
                    <div className="card-header">
                      <div>
                        <p className="label">{input.unit.toUpperCase()}</p>
                        <h3>{input.name}</h3>
                      </div>
                    </div>
                    <div className="card-body">
                      <p>
                        Costo actual:{" "}
                        <strong>{formatCLP(input.cost_per_unit)}</strong> CLP
                      </p>
                      <p>
                        Reposicion: <strong>{input.reorder_point}</strong>
                      </p>
                    </div>
                    <div className="card-actions">
                      <button
                        className="btn ghost"
                        onClick={() => startEditInput(input)}
                      >
                        Editar
                      </button>
                      <button
                        className="btn danger"
                        onClick={() => handleDeleteInput(input.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>Gestion de Productos</h2>
                  <p>
                    Crea carteras, define sus insumos y visualiza el costo
                    calculado.
                  </p>
                </div>
              </div>

              <form className="form-grid" onSubmit={handleProductSubmit}>
                <div className="field">
                  <label>Nombre</label>
                  <input
                    value={productForm.name}
                    onChange={(event) =>
                      setProductForm({ ...productForm, name: event.target.value })
                    }
                    placeholder="Cartera Andes"
                    required
                  />
                </div>
                <div className="field">
                  <label>Descripcion</label>
                  <input
                    value={productForm.description}
                    onChange={(event) =>
                      setProductForm({
                        ...productForm,
                        description: event.target.value,
                      })
                    }
                    placeholder="Cuero y lana"
                  />
                </div>
                <div className="field">
                  <label>Foto (URL)</label>
                  <input
                    value={productForm.photo_url}
                    onChange={(event) =>
                      setProductForm({
                        ...productForm,
                        photo_url: event.target.value,
                      })
                    }
                    placeholder="https://..."
                  />
                </div>
                <div className="actions">
                  <button className="btn primary" type="submit">
                    {editingProductId ? "Actualizar" : "Crear producto"}
                  </button>
                  {editingProductId && (
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={resetProductForm}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>

              <div className="grid two">
                <div className="list">
                  {products.map((product) => (
                    <article
                      key={product.id}
                      className={`list-item ${
                        selectedProductId === product.id ? "selected" : ""
                      }`}
                    >
                      <button
                        className="list-main"
                        onClick={() => handleSelectProduct(product.id)}
                      >
                        <div>
                          <h3>{product.name}</h3>
                          <p className="muted">
                            {product.description || "Sin descripcion"}
                          </p>
                        </div>
                      </button>
                      <div className="list-actions">
                        <button
                          className="btn ghost"
                          onClick={() => startEditProduct(product)}
                        >
                          Editar
                        </button>
                        <button
                          className="btn danger"
                          onClick={() => handleDeleteProduct(product.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="detail">
                  {productFull ? (
                    <>
                      <div className="detail-header">
                        <div>
                          <h3>{productFull.product.name}</h3>
                          <p className="muted">
                            {productFull.product.description || "Sin descripcion"}
                          </p>
                        </div>
                        {productFull.product.photo_url && (
                          <img
                            className="thumb"
                            src={productFull.product.photo_url}
                            alt={productFull.product.name}
                          />
                        )}
                      </div>

                      <div className="summary">
                        <div>
                          <p className="label">Costo materiales</p>
                          <h4>
                            {productCosting
                              ? formatCLP(productCosting.material_cost)
                              : "-"}
                          </h4>
                        </div>
                        <div>
                          <p className="label">Publicidad</p>
                          <h4>
                            {productCosting
                              ? formatCLP(productCosting.ad_allocated_cost)
                              : "-"}
                          </h4>
                        </div>
                        <div>
                          <p className="label">Total</p>
                          <h4>
                            {productCosting
                              ? formatCLP(productCosting.total_cost)
                              : "-"}
                          </h4>
                        </div>
                      </div>
                      <div className="bom">
                        <div className="bom-header">
                          <h4>Receta (BOM)</h4>
                          <button className="btn ghost" onClick={addBomRow}>
                            + Agregar insumo
                          </button>
                        </div>
                        <div className="bom-table">
                          <div className="bom-row bom-row-header">
                            <span>Insumo</span>
                            <span>Cantidad</span>
                            <span>Merma</span>
                            <span>Notas</span>
                            <span>Accion</span>
                          </div>
                          {bomDraft.map((row, index) => (
                            <div
                              className="bom-row bom-row-panel"
                              key={`${row.input_id}-${index}`}
                            >
                              <select
                                value={row.input_id}
                                onChange={(event) =>
                                  updateBomRow(index, { input_id: event.target.value })
                                }
                              >
                                <option value="">Selecciona insumo</option>
                                {inputs.map((input) => (
                                  <option key={input.id} value={input.id}>
                                    {input.name} ({input.unit})
                                  </option>
                                ))}
                              </select>
                              <input
                                type="number"
                                placeholder="Cantidad"
                                value={row.quantity_per_unit}
                                onChange={(event) =>
                                  updateBomRow(index, {
                                    quantity_per_unit: event.target.value,
                                  })
                                }
                                min="0"
                              />
                              <input
                                type="number"
                                step="0.01"
                                placeholder="Merma"
                                value={row.wastage_rate}
                                onChange={(event) =>
                                  updateBomRow(index, {
                                    wastage_rate: event.target.value,
                                  })
                                }
                                min="0"
                                max="1"
                              />
                              <input
                                placeholder="Notas"
                                value={row.notes}
                                onChange={(event) =>
                                  updateBomRow(index, { notes: event.target.value })
                                }
                              />
                              <button
                                className="btn danger"
                                onClick={() => removeBomRow(index)}
                              >
                                Quitar
                              </button>
                            </div>
                          ))}
                        </div>
                        <button className="btn primary" onClick={saveBom}>
                          Guardar receta
                        </button>
                      </div>

                      {productCosting && (
                        <div className="materials">
                          <h4>Detalle de materiales</h4>
                          <div className="materials-grid">
                            {productCosting.materials_breakdown.map((item) => (
                              <div className="material-card" key={item.input_id}>
                                <p className="label">{item.unit}</p>
                                <h5>{item.name}</h5>
                                <p className="muted">
                                  {item.quantity_per_unit} x {item.cost_per_unit ?? 0}
                                </p>
                                <p>
                                  <strong>{formatCLP(item.line_cost)}</strong> CLP
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="empty-state">
                      <p>Selecciona un producto para configurar su receta.</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
