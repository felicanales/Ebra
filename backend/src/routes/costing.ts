import { Router } from "express";
import { getProductCosting } from "../controllers/costingController";
import { asyncHandler } from "./asyncHandler";

export const costingRouter = Router();

costingRouter.get("/products/:id", asyncHandler(getProductCosting));
