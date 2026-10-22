import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeDeskcommForm, type DeskcommOrder } from "../backend/src/lib/deskcomm-crm";
const order: DeskcommOrder = {
  id: "111111111111111111111111",
  name: "Client fictif",
  phone: "0600000000",
  street: "Adresse fictive",
  city: "Test",
  region: "Test",
  totalAmount: 1,
  shippingCost: 0,
  status: "PENDING",
  paymentMethod: "COD",
  items: [],
};
test("CRM receives an explicit Moroccan country code for a local checkout number", () => {
  const form = encodeDeskcommForm(order);
  assert.equal(form.get("telefone"), "+212600000000");
  assert.equal(form.get("pedido_id"), order.id);
  assert.equal(form.get("aiConsent"), "false");
});
test("an international Moroccan phone is preserved on retries", () =>
  assert.equal(
    encodeDeskcommForm({ ...order, phone: "+212600000000" }).get("telefone"),
    "+212600000000",
  ));
test("other explicit international country codes are not silently rewritten", () =>
  assert.equal(
    encodeDeskcommForm({ ...order, phone: "+12025550123" }).get("telefone"),
    "+12025550123",
  ));

test("site-confirmed orders keep legacy CRM delivery but explicitly suppress confirmation", () => {
  const form = encodeDeskcommForm({ ...order, confirmationMethod: "SITE", confirmationRequired: false, confirmedAt: "2026-10-22T08:00:00.000Z", status: "CONFIRMED" });
  assert.equal(form.get("confirmation_required"), "false");
  assert.equal(form.get("ai_service_consent"), "false");
  assert.equal(form.get("confirmation_method"), "SITE");
  assert.equal(form.get("confirmed_at"), "2026-10-22T08:00:00.000Z");
  assert.equal(form.get("pedido_id"), order.id);
  assert.equal(encodeDeskcommForm(order).has("confirmation_required"), false);
});
