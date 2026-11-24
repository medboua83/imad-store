import { moroccoDayBoundary } from "./order-history-query";

const calendar = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit", day: "2-digit",
});
/** The one-day choice is today's Moroccan calendar day; other periods stay rolling. */
export function analyticsPeriod(days: number, now = new Date()) {
    if (![1, 7, 30, 90].includes(days) || !Number.isFinite(now.getTime()))
        throw new RangeError("Unsupported analytics period");
    const end = new Date(now.getTime());
    if (days !== 1) return { start: new Date(end.getTime() - days * 86400_000), end };
    const parts = calendar.formatToParts(end);
    const part = (type: string) => parts.find(value => value.type === type)!.value;
    const day = `${part("year")}-${part("month")}-${part("day")}`;
    return { start: new Date(moroccoDayBoundary(day).replace(" ", "T") + "Z"), end };
}
