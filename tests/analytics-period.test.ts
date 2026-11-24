import { test } from "node:test";
import assert from "node:assert/strict";
import { analyticsPeriod, storeCalendar } from "../backend/src/lib/analytics-period";

for (const [at, start] of [
    ["2026-11-24T23:59:59.999Z", "2026-11-24T00:00:00.000Z"],
    ["2026-11-25T00:00:00.000Z", "2026-11-25T00:00:00.000Z"],
    ["2026-02-15T22:00:00.000Z", "2026-02-14T23:00:00.000Z"],
    ["2026-03-22T22:00:00.000Z", "2026-03-22T00:00:00.000Z"],
]) test(`Today follows Moroccan midnight and clock changes at ${at}`, () => {
    const now = new Date(at), period = analyticsPeriod(1, now);
    assert.equal(period.start.toISOString(), start);
    assert.equal(period.end.toISOString(), at);
    assert.equal(now.toISOString(), at);
});
test("Historical analytics periods retain their rolling duration", () => {
    const now = new Date("2026-11-24T23:30:00Z");
    for (const days of [7, 30, 90]) {
        const period = analyticsPeriod(days, now);
        assert.equal(period.end.getTime() - period.start.getTime(), days * 86400_000);
    }
    for (const days of [0, 2, -1, 365]) assert.throws(() => analyticsPeriod(days, now), RangeError);
});

test("The authoritative store calendar handles 23-hour and 25-hour days", () => {
    for (const [instant, day, hours] of [["2026-02-15T22:00:00Z", "2026-02-15", 25], ["2026-03-22T22:00:00Z", "2026-03-22", 23]] as const) {
        const calendar = storeCalendar(new Date(instant));
        assert.equal(calendar.day, day);
        assert.equal(calendar.timeZone, "Africa/Casablanca");
        assert.equal((calendar.end.getTime() - calendar.start.getTime()) / 3600_000, hours);
    }
});
