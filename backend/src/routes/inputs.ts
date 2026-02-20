import { Router } from "express";
import {
  addInputCost,
  createInput,
  deleteInput,
  getInputs,
  updateInput,
} from "../controllers/inputsController";
import { asyncHandler } from "./asyncHandler";

export const inputsRouter = Router();

inputsRouter.get("/", asyncHandler(getInputs));
inputsRouter.post("/", asyncHandler(createInput));
inputsRouter.patch("/:id", asyncHandler(updateInput));
inputsRouter.delete("/:id", asyncHandler(deleteInput));
inputsRouter.post("/:id/cost", asyncHandler(addInputCost));
