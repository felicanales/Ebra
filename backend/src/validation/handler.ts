import { Response } from "express";
import { ZodError } from "zod";

export function respondValidationError(res: Response, error: ZodError) {
  return res.status(400).json({
    error: "Validation error",
    details: error.flatten(),
  });
}
