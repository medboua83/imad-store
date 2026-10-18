import "dotenv/config";
import app from "./app";
import { syncSheetsToDatabase } from "./lib/notifications";
import { processDeskcommOutbox } from "./lib/deskcomm-outbox";
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
