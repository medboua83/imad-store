/** Public ownership token only. Never accept executable HTML or additional attributes. */
export function normalizeMetaDomainVerification(value: unknown): string | null {
    if (value === null || value === undefined) return "";
    if (typeof value !== "string" || value.length > 512) return null;
    const text = value.trim();
    if (!text || /^[A-Za-z0-9_-]{1,128}$/.test(text)) return text;
    const nameFirst = /^<meta\s+name\s*=\s*(["'])facebook-domain-verification\1\s+content\s*=\s*(["'])([A-Za-z0-9_-]{1,128})\2\s*\/?>$/i.exec(text);
    if (nameFirst) return nameFirst[3];
    const contentFirst = /^<meta\s+content\s*=\s*(["'])([A-Za-z0-9_-]{1,128})\1\s+name\s*=\s*(["'])facebook-domain-verification\3\s*\/?>$/i.exec(text);
    return contentFirst?.[2] ?? null;
}
