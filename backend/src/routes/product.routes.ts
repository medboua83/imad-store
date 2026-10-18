import { validateObjectId } from "../lib/validation";
import { Router, IRouter } from "express";
import {
    getProducts,
    getAdminProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
} from "../controllers/product.controller";
import { authenticate, requireAdmin } from "../middleware/auth.middleware";

export const productRoutes: IRouter = Router();
productRoutes.param("id", validateObjectId);

// Public
productRoutes.get("/", getProducts);
productRoutes.get("/admin/catalog", authenticate, requireAdmin, getAdminProducts);
productRoutes.get("/:slug", getProduct);

// Admin only
productRoutes.post("/", authenticate, requireAdmin, createProduct);
productRoutes.put("/:id", authenticate, requireAdmin, updateProduct);
productRoutes.delete("/:id", authenticate, requireAdmin, deleteProduct);
