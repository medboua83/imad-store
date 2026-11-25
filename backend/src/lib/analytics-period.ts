import { moroccoDayBoundary } from "./order-history-query";

const calendar = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit", day: "2-digit",
});
export function storeCalendar(now = new Date()) {
    if (!Number.isFinite(now.getTime())) throw new RangeError("Invalid calendar instant");
    const parts = calendar.formatToParts(now);
    const part = (type: string) => parts.find(value => value.type === type)!.value;
    const day = `${part("year")}-${part("month")}-${part("day")}`;
    const boundary = (following = false) => new Date(moroccoDayBoundary(day, following).replace(" ", "T") + "Z");
    return { day, start: boundary(), end: boundary(true), timeZone: "Africa/Casablanca" as const };
}
/** The one-day choice is today's Moroccan calendar day; other periods stay rolling. */
export function analyticsPeriod(days: number, now = new Date()) {
    if (![1, 7, 30, 90].includes(days) || !Number.isFinite(now.getTime()))
        throw new RangeError("Unsupported analytics period");
    const end = new Date(now.getTime());
    if (days !== 1) return { start: new Date(end.getTime() - days * 86400_000), end };
    return { start: storeCalendar(end).start, end };
}

/** Inclusive calendar-day ranges for order creation filters, ending with today. */
export function storeOrderPeriod(days = 1, now = new Date()) {
    if (![1, 7, 30, 90].includes(days)) throw new RangeError("Unsupported order period");
    const current = storeCalendar(now);
    const first = new Date(current.day + "T00:00:00Z");
    first.setUTCDate(first.getUTCDate() - days + 1);
    const from = first.toISOString().slice(0, 10);
    const start = new Date(moroccoDayBoundary(from).replace(" ", "T") + "Z");
    return { ...current, days, from, start };
}
