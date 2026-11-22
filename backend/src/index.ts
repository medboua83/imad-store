import "dotenv/config";
import app from "./app";
import { syncSheetsToDatabase } from "./lib/notifications";
import { processDeskcommOutbox } from "./lib/deskcomm-outbox";
import { processOlivraisonQueue } from "./lib/olivraison";
const { startHostedOlivraisonWorker } = require("../../scripts/hosted-olivraison-worker.cjs");
const stopCarrier = startHostedOlivraisonWorker({ tick: processOlivraisonQueue });
const stopAccessMail = require("../../scripts/hosted-auth-mail-worker.cjs").startHostedAuthMailWorker();
const PORT = process.env.PORT ?? 4000;
export const server = app.listen(PORT, () => {
    const address = server.address();
    const port = address && typeof address === "object" ? address.port : PORT;
    console.log(`Imad Store API running on http://localhost:${port}`);
});
server.once("close", () => { void stopCarrier(); void stopAccessMail(); });
setInterval(() => {
    syncSheetsToDatabase().catch(() => console.error("Sheets sync failed"));
}, 30_000);
setInterval(() => {
    processDeskcommOutbox().catch(() => console.error("CRM worker failed"));
}, 15_000);
export default app;
