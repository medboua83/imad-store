import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMetaDomainVerification as normalize } from "@imad-store/shared";

test("Meta ownership codes accept a token or its exact tag, preserving case", () => {
    const code = "Fixture_Meta_Domain_1234567890";
    for (const input of [code, `  ${code}  `, `<meta name="facebook-domain-verification" content="${code}" />`,
        `<meta content='${code}' name='facebook-domain-verification'>`,
        `<meta\n name = 'facebook-domain-verification'\n content = '${code}' >`])
        assert.equal(normalize(input), code);
    for (const input of ["", "  ", null, undefined]) assert.equal(normalize(input), "");
});

test("Meta verification never accepts arbitrary tags, extra attributes or code", () => {
    for (const input of ["<script>alert(1)</script>", `a\" onload=\"alert(1)`, "a".repeat(129), [], 123,
        `<meta name="facebook-domain-verification" content="abc" onload="alert(1)">`,
        `<meta name="google-site-verification" content="abc">`,
        `<meta name="facebook-domain-verification" content="abc"><script></script>`,
        `<meta name="facebook-domain-verification" content=""><meta name="x">`])
        assert.equal(normalize(input), null);
});
