import { Router } from "express";
import { getDashboardKpis } from "../controllers/dashboardController";
import { asyncHandler } from "./asyncHandler";

export const dashboardRouter = Router();

dashboardRouter.get("/kpis", asyncHandler(getDashboardKpis));
