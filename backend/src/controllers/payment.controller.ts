import { Request, Response } from "express";

// COD is the only supported checkout. Keep dormant card capabilities closed on the server.
export function createPaymentIntent(_req: Request, res: Response) {
    res.status(410).json({ success: false, error: "Le paiement par carte est indisponible. Utilisez le paiement à la livraison." });
}
export function handleWebhook(_req: Request, res: Response) {
    res.status(410).json({ success: false, error: "Le traitement des paiements par carte est désactivé." });
}
