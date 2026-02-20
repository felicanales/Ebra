import dotenv from "dotenv";
import express from "express";
import { healthRouter } from "./routes/health";
import { inputsRouter } from "./routes/inputs";
import { productsRouter } from "./routes/products";
import { inventoryRouter } from "./routes/inventory";
import { costingRouter } from "./routes/costing";
import { dashboardRouter } from "./routes/dashboard";

dotenv.config();

const app = express();

app.use(express.json());

app.use("/health", healthRouter);
app.use("/inputs", inputsRouter);
app.use("/products", productsRouter);
app.use("/inventory", inventoryRouter);
app.use("/costing", costingRouter);
app.use("/dashboard", dashboardRouter);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on port ${port}`);
});
