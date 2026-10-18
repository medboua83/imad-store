import { validateObjectId } from "../lib/validation";
import { Router, IRouter } from "express";
import {
    getCategories,
    getCategory,
    createCategory,
    updateCategory,
    deleteCategory,
} from "../controllers/category.controller";
import { authenticate, requireAdmin } from "../middleware/auth.middleware";

export const categoryRoutes: IRouter = Router();
categoryRoutes.param("id", validateObjectId);

// Public
categoryRoutes.get("/", getCategories);
categoryRoutes.get("/:slug", getCategory);

// Admin only
categoryRoutes.post("/", authenticate, requireAdmin, createCategory);
categoryRoutes.put("/:id", authenticate, requireAdmin, updateCategory);
categoryRoutes.delete("/:id", authenticate, requireAdmin, deleteCategory);
