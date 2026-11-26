import { carrierNeedsReview } from "./carrier-status";

export const orderTrackingFilters = ["ALL", "ATTENTION", "REPORTED", "UNLINKED"] as const;
export type OrderTrackingFilter = (typeof orderTrackingFilters)[number];
export const attentionTrackingStates = ["ATTENTION", "RETRY", "DISCONNECTED", "REVIEW_REQUIRED"] as const;
export const attentionDeliveryStatuses = ["REPORTED", "UNKNOWN_CALL"] as const;
type ShipmentSummary = { state: string; carrierStatus?: string | null; lastError?: string | null;
    incidentFingerprint?: string | null; incidentClosure?: { fingerprint: string } | null };

/** Read-only view: never implies a payment, cancellation or carrier action. */
export function orderTrackingMatches(
    shipment: ShipmentSummary | null | undefined,
    filter: string = "ALL",
): boolean {
    if (filter === "ALL") return true;
    if (filter === "UNLINKED") return !shipment;
    if (!shipment) return false;
    if (filter === "REPORTED") return shipment.carrierStatus === "REPORTED";
    if (filter !== "ATTENTION") return false;
    if (shipment.state === "ATTENTION" && /^[a-f0-9]{64}$/.test(shipment.incidentFingerprint || "") &&
        shipment.incidentClosure?.fingerprint === shipment.incidentFingerprint) return false;
    return (
        attentionTrackingStates.some((state) => state === shipment.state) ||
        !!shipment.lastError ||
        (!!shipment.carrierStatus &&
            (attentionDeliveryStatuses.some((status) => status === shipment.carrierStatus) ||
                carrierNeedsReview(shipment.carrierStatus)))
    );
}
