import test from "node:test";
import assert from "node:assert/strict";
import { productInformationError, publicProductInformation } from "@imad-store/shared";
test("Unverified measurement drafts never become a public size chart", () => {
    const draft = { composition: "Matière fournie pour le test", sizeGuide: { basis: "BODY", verified: false, rows: [{ size: "M", chest: 90 }] } };
    assert.equal(productInformationError(draft), null);
    assert.equal(publicProductInformation(draft)?.sizeGuide, undefined);
    assert.equal(publicProductInformation(draft)?.composition, draft.composition);
    assert.equal(publicProductInformation({ ...draft, sizeGuide: { ...draft.sizeGuide, verified: true } })?.sizeGuide?.rows[0].chest, 90);
    assert.equal(publicProductInformation(null), null);
});
test("Measurements reject duplicated sizes, invalid numbers, mixed units and unexpected fields", () => {
    const guide = (rows: unknown[], basis = "BODY") => ({ sizeGuide: { basis, verified: true, rows } });
    for (const value of [guide([]), guide([{size:"M",chest:-1}]), guide([{size:"M",chest:NaN}]), guide([{size:"M",chest:90},{size:" m ",chest:91}]), guide([{size:"40",footLength:25}]), guide([{size:"40",chest:90}],"FOOT"), guide([{size:"M"}]), {composition: {html:"bad"}}, {sizeGuide:{basis:"INCH",verified:true,rows:[]}}]) assert.ok(productInformationError(value));
    assert.equal(productInformationError(guide([{size:"40",footLength:25.5}],"FOOT")), null);
    assert.equal(productInformationError(guide([{size:"M",chest:100,length:120}],"GARMENT")), null);
});
