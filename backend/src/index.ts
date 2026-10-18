import "dotenv/config";
import app from "./app";
import { syncSheetsToDatabase } from "./lib/notifications";
import { processDeskcommOutbox } from "./lib/deskcomm-outbox";
import { ensureProductionData } from "./lib/seedAdmin";
const PORT = process.env.PORT ?? 4000;
app.listen(PORT, async () => {
    console.log(`Imad Store API running on http://localhost:${PORT}`);
    if (process.env.IMAD_SEED_DEMO === "true") await ensureProductionData();
});
setInterval(() => { syncSheetsToDatabase().catch(() => console.error("Sheets sync failed")); }, 30_000);
setInterval(() => { processDeskcommOutbox().catch(() => console.error("CRM worker failed")); }, 15_000);
export default app;
