# Backend (Node.js + Express + TypeScript)

## Configuración
1. Copia `.env.example` a `.env` y define `DATABASE_URL` desde Supabase.
2. En Supabase, usa el SQL Editor y ejecuta `supabase_schema.sql` para crear las tablas.

Ejemplo de `DATABASE_URL` desde Supabase:
- Project Settings → Database → Connection string (URI)

> Nota: Supabase requiere SSL. El pool usa SSL automáticamente cuando detecta `supabase.co` en la URL.

## Desarrollo
```bash
cd backend
npm install
npm run dev
```

## Build y producción
```bash
npm run build
npm start
```

## Endpoints
- `GET /health`

**Insumos**
- `GET /inputs`
- `POST /inputs`
- `PATCH /inputs/:id`
- `DELETE /inputs/:id`
- `POST /inputs/:id/cost`

**Productos (Carteras)**
- `GET /products`
- `POST /products`
- `PATCH /products/:id`
- `DELETE /products/:id`
- `POST /products/:id/bom`
- `GET /products/:id/full`

**Inventario**
- `POST /inventory/movements`
- `GET /inventory/summary`

**Costeo**
- `GET /costing/products/:id`

**Dashboard**
- `GET /dashboard/kpis`
