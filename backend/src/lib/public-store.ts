import { assertStoreInstallation } from "./store-installation";
import { ZodError } from "zod";
import { readPublicProducts, readPublicProduct, readPublicRecommendations } from "../controllers/product.controller";
import { readCategories } from "../controllers/category.controller";
import { readSettings } from "../controllers/settings.controller";
import { readPublicContent } from "./public-content";
import { AppError } from "../middleware/error.middleware";

// Only public reads are available to server-rendered pages. HTTP controllers
// use these same services, including product publication and query validation.
export async function readPublicStore(path: string) {
    if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Invalid public read path");
    const url = new URL(path, "http://internal.invalid");
    try {
        await assertStoreInstallation();
        let body: unknown;
        if (url.pathname === "/products") body = await readPublicProducts(Object.fromEntries(url.searchParams));
        else if (/^\/products\/[a-z0-9-]+\/recommendations$/.test(url.pathname)) body = await readPublicRecommendations(url.pathname.split("/")[2]);
        else if (/^\/products\/[a-z0-9-]+$/.test(url.pathname)) body = await readPublicProduct(url.pathname.slice(10));
        else if (url.pathname === "/categories") body = await readCategories();
        else if (url.pathname === "/settings") body = await readSettings();
        else if (url.pathname === "/content") body = await readPublicContent();
        else return { status: 404, body: { success: false } };
        // Match JSON-over-HTTP Date serialization before crossing into Next.
        return { status: 200, body: JSON.parse(JSON.stringify(body)) as unknown };
    } catch (error) {
        if (error instanceof AppError) return { status: error.status, body: { success: false } };
        if (error instanceof ZodError) return { status: 400, body: { success: false } };
        throw error;
    }
}
