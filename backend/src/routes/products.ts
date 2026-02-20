import { Router } from "express";
import {
  createProduct,
  deleteProduct,
  getProductFull,
  getProducts,
  updateProduct,
  upsertBom,
} from "../controllers/productsController";
import { asyncHandler } from "./asyncHandler";

export const productsRouter = Router();

productsRouter.get("/", asyncHandler(getProducts));
productsRouter.post("/", asyncHandler(createProduct));
productsRouter.patch("/:id", asyncHandler(updateProduct));
productsRouter.delete("/:id", asyncHandler(deleteProduct));
productsRouter.post("/:id/bom", asyncHandler(upsertBom));
productsRouter.get("/:id/full", asyncHandler(getProductFull));
