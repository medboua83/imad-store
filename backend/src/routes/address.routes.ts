import { validateObjectId } from "../lib/validation";
import { Router, IRouter } from "express";
import {
    getAddresses,
    createAddress,
    updateAddress,
    deleteAddress,
} from "../controllers/address.controller";
import { authenticate } from "../middleware/auth.middleware";

export const addressRoutes: IRouter = Router();
addressRoutes.param("id", validateObjectId);

addressRoutes.get("/", authenticate, getAddresses);
addressRoutes.post("/", authenticate, createAddress);
addressRoutes.put("/:id", authenticate, updateAddress);
addressRoutes.delete("/:id", authenticate, deleteAddress);
