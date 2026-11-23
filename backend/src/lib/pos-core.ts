import { z } from "zod";
export const POS_MAX_CENTS = 2_000_000_000;
export const posIdentifier = z.string().regex(/^[a-f0-9]{24}$/);
export const posKey = z.string().regex(/^[a-zA-Z0-9_-]{16,128}$/);
