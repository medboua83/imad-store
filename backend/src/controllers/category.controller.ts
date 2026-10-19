import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error.middleware";

const categorySchema = z.object({
    slug: z.string().min(1),
    nameFr: z.string().min(1),
    nameAr: z.string().min(1),
    nameEn: z.string().min(1),
    image: z.string().url().optional(),
});

export async function readCategories() {
    const categories = await prisma.category.findMany({
        include: { _count: { select: { products: true } } },
        orderBy: { nameFr: "asc" },
    });
    return { success: true, data: categories };
}
export async function getCategories(_req: Request, res: Response) {
    res.json(await readCategories());
}

export async function getCategory(req: Request, res: Response) {
    const { slug } = req.params;
    const category = await prisma.category.findUnique({
        where: { slug },
        include: {
            products: {
                where: { status: "ACTIVE" },
                include: { variants: true },
                orderBy: { createdAt: "desc" },
            },
        },
    });
    if (!category) throw new AppError("Category not found", 404);
    res.json({ success: true, data: category });
}

export async function createCategory(req: Request, res: Response) {
    const body = categorySchema.parse(req.body);
    const category = await prisma.category.create({ data: body });
    res.status(201).json({ success: true, data: category });
}

export async function updateCategory(req: Request, res: Response) {
    const { id } = req.params;
    const body = categorySchema.partial().parse(req.body);
    const category = await prisma.category.update({ where: { id }, data: body });
    res.json({ success: true, data: category });
}

export async function deleteCategory(req: Request, res: Response) {
    const { id } = req.params;
    await prisma.category.delete({ where: { id } });
    res.json({ success: true, message: "Category deleted" });
}
