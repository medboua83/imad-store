import { transitionOrderStatus } from "./order-lifecycle";
import { statusSchema, objectIdSchema } from "./validation";
import { google } from "googleapis";
import { prisma } from "./prisma";

// Order shape used for Sheets export — Prisma order + nested items
type OrderWithItems = {
    id: string;
    createdAt: Date;
    customerName: string | null;
    customerPhone: string | null;
    customerEmail: string | null;
    fullName: string | null;
    street: string | null;
    city: string | null;
    region: string | null;
    postalCode: string | null;
    paymentMethod: string;
    paymentStatus: string;
    status: string;
    totalAmount: number;
    notes: string | null;
    items: {
        quantity: number;
        unitPrice: number;
        product: { nameFr: string } | null;
    }[];
};

// ─── Google Sheets Integration ────────────────────────────────────────────────

export async function appendOrderToSheets(order: OrderWithItems): Promise<void> {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
        console.log("⚠️ Google Sheets credentials not set. Skipping sheets sync.");
        return;
    }

    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: clientEmail,
                private_key: privateKey,
            },
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });

        const sheets = google.sheets({ version: "v4", auth });

        const values: string[][] = [[
            order.id,
            new Date(order.createdAt).toISOString(),
            order.customerName ?? "",
            order.customerPhone ?? "",
            order.customerEmail ?? "",
            order.fullName ?? "",
            order.street ?? "",
            order.city ?? "",
            order.region ?? "",
            order.postalCode ?? "",
            order.items.map((i) => `${i.product?.nameFr ?? "Produit"} x${i.quantity}`).join(", "),
            String(order.totalAmount),
            order.paymentMethod,
            order.paymentStatus,
            order.status,
            order.notes ?? "",
        ]];

        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: "Orders!A:O",
            valueInputOption: "USER_ENTERED",
            requestBody: { values },
        });

        console.log(`✅ Order ${order.id} appended to Google Sheets`);
    } catch (err) {
        console.error("❌ Google Sheets append error:", err);
    }
}

export async function updateOrderStatusInSheets(orderId: string, status: string): Promise<void> {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
        console.log("⚠️ Google Sheets credentials not set. Skipping sheets sync.");
        return;
    }

    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: clientEmail,
                private_key: privateKey,
            },
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });

        const sheets = google.sheets({ version: "v4", auth });

        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Orders!A:A",
        });

        const rows: string[][] = res.data.values ?? [];
        const rowIndex = rows.findIndex((row: string[]) => row[0] === orderId);

        if (rowIndex === -1) {
            console.log(`⚠️ Order ${orderId} not found in Google Sheets for status update`);
            return;
        }

        const range = `Orders!O${rowIndex + 1}`;
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: "USER_ENTERED",
            requestBody: { values: [[status]] },
        });

        console.log(`✅ Order ${orderId} status updated to ${status} in Google Sheets`);
    } catch (err) {
        console.error("❌ Google Sheets status update error:", err);
    }
}

// Background worker: poll Google Sheets for status changes every 30s
export async function syncSheetsToDatabase(): Promise<void> {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) return;

    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: clientEmail,
                private_key: privateKey,
            },
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });

        const sheets = google.sheets({ version: "v4", auth });

        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Orders!A2:O",
        });

        const rows: string[][] = res.data.values ?? [];

        for (const row of rows) {
            const [id, , , , , , , , , , , , , , sheetStatus] = row;
            if (!objectIdSchema.safeParse(id).success) continue;

            const order = await prisma.order.findUnique({
                where: { id },
                select: { id: true, status: true },
            });

            if (!order) continue;

            const parsed = statusSchema.safeParse(sheetStatus);
            if (parsed.success && parsed.data !== order.status) {
                try { await transitionOrderStatus(id, parsed.data, "sheets"); }
                catch { console.warn("Sheets status transition rejected"); }
            }

        }
    } catch (err) {
        console.error("❌ Google Sheets sync error:", err);
    }
}
