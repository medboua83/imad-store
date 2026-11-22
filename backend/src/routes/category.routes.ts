import { validateObjectId } from "../lib/validation";
import { Router, IRouter } from "express";
import {
    getCategories,
    getCategory,
    createCategory,
    updateCategory,
    deleteCategory,
} from "../controllers/category.controller";
import { authenticate, requirePermission } from "../middleware/auth.middleware";

export const categoryRoutes: IRouter = Router();
categoryRoutes.param("id", validateObjectId);

// Public
categoryRoutes.get("/", getCategories);
categoryRoutes.get("/:slug", getCategory);

// Admin only
categoryRoutes.post("/", authenticate, requirePermission("catalogue.manage"), createCategory);
categoryRoutes.put("/:id", authenticate, requirePermission("catalogue.manage"), updateCategory);
categoryRoutes.delete("/:id", authenticate, requirePermission("catalogue.manage"), deleteCategory);
