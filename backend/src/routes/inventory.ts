import { Router } from "express";
import {
  createMovement,
  getInventorySummary,
} from "../controllers/inventoryController";
import { asyncHandler } from "./asyncHandler";

export const inventoryRouter = Router();

inventoryRouter.post("/movements", asyncHandler(createMovement));
inventoryRouter.get("/summary", asyncHandler(getInventorySummary));
