/** Codes from Olivraison's public tracking guide and Partners API. Unknown codes stay visible. */
export const olivraisonStatusLabels: Readonly<Record<string, string>> = {
    CREATED: "Colis créé",
    CONFIRMED: "Colis confirmé",
    PICKUP: "Ramassage prévu",
    PICKEDUP: "Ramassé",
    PICKED_UP: "Ramassé",
    INHOUSE: "Reçu à l’entrepôt",
    RECIVED: "Reçu à l’entrepôt",
    ENROUTE: "En route",
    ASSIGN: "Confié au livreur",
    TRANSIT: "En livraison",
    SCHEDULED: "Livraison programmée",
    REPORTED: "Livraison reportée",
    UNKNOWN_CALL: "Destinataire injoignable",
    DELIVERED: "Livré",
    CANCELED: "Annulé chez Olivraison",
    CANCELLED: "Annulé chez Olivraison",
    CUSTOMER_CANCELED: "Annulé chez Olivraison",
    RETURNED: "Retourné au marchand",
    DELETED: "Supprimé chez Olivraison",
    ARCHIVED: "Archivé chez Olivraison",
};

export function carrierOrderProgress(status: string): "SHIPPED" | "DELIVERED" | null {
    if (status === "DELIVERED") return "DELIVERED";
    return ["PICKEDUP", "PICKED_UP", "INHOUSE", "RECIVED", "ENROUTE", "ASSIGN", "TRANSIT", "SCHEDULED", "REPORTED", "UNKNOWN_CALL"].includes(status)
        ? "SHIPPED" : null;
}

export function carrierStatusLabel(status: string): string {
    return Object.prototype.hasOwnProperty.call(olivraisonStatusLabels, status)
        ? olivraisonStatusLabels[status] : status;
}

export function carrierNeedsReview(status: string): boolean {
    return ["CANCELED", "CANCELLED", "RETURNED", "DELETED", "CUSTOMER_CANCELED"].includes(status)
        || !Object.prototype.hasOwnProperty.call(olivraisonStatusLabels, status);
}
