import "dotenv/config";
import app from "./app";
import { syncSheetsToDatabase } from "./lib/notifications";
import { processDeskcommOutbox } from "./lib/deskcomm-outbox";
import { processOlivraisonQueue } from "./lib/olivraison";
let carrierPending = false;
const carrierTimer = setInterval(async () => {
    if (carrierPending) return;
    carrierPending = true;
    try { await processOlivraisonQueue(); } catch { console.error("Olivraison worker failed"); }
    finally { carrierPending = false; }
}, 15_000);
carrierTimer.unref();
const PORT = process.env.PORT ?? 4000;
const server = app.listen(PORT, () => {
    const address = server.address();
    const port = address && typeof address === "object" ? address.port : PORT;
    console.log(`Imad Store API running on http://localhost:${port}`);
});
setInterval(() => {
    syncSheetsToDatabase().catch(() => console.error("Sheets sync failed"));
}, 30_000);
setInterval(() => {
    processDeskcommOutbox().catch(() => console.error("CRM worker failed"));
}, 15_000);
export default app;
