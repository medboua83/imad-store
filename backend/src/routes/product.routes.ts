import { validateObjectId } from "../lib/validation";
import { Router, IRouter } from "express";
import {
    getProducts,
    getAdminProductBySlug,
    getAdminProducts,
    getProduct,
    getProductRecommendations,
    createProduct,
    updateProduct,
    deleteProduct,
} from "../controllers/product.controller";
import { authenticate, requirePermission } from "../middleware/auth.middleware";

export const productRoutes: IRouter = Router();
productRoutes.param("id", validateObjectId);

// Public
productRoutes.get("/", getProducts);
productRoutes.get("/admin/catalog", authenticate, requirePermission("catalogue.manage", "content.manage"), getAdminProducts);
productRoutes.get("/admin/catalog/:slug", authenticate, requirePermission("catalogue.manage", "content.manage"), getAdminProductBySlug);
productRoutes.get("/:slug/recommendations", getProductRecommendations);
productRoutes.get("/:slug", getProduct);

// Admin only
productRoutes.post("/", authenticate, requirePermission("catalogue.manage"), createProduct);
productRoutes.put("/:id", authenticate, requirePermission("catalogue.manage"), updateProduct);
productRoutes.delete("/:id", authenticate, requirePermission("catalogue.manage"), deleteProduct);
