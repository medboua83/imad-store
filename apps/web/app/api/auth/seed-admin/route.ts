import { NextResponse } from "next/server";
// Destructive/bootstrap endpoint removed.
export async function GET() {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
}
