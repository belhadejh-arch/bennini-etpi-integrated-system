import { strict as assert } from "node:assert";
import { test } from "node:test";
import { frenchNotificationCopy } from "../notification-copy";

test("French notifications translate system text without translating user names or reasons", () => {
  const expense = frenchNotificationCopy({ type: "new_expense", label: "قطع غيار", detail: "ملاحظات كتبها المستخدم" });
  assert.equal(expense.title, "Nouvelle dépense : قطع غيار");
  assert.equal(expense.message, "ملاحظات كتبها المستخدم");
  const field = frenchNotificationCopy({ type: "field_review", label: "قطع غيار", detail: "موقع الجزائر", created_by_name: "أحمد" });
  assert.equal(field.title, "Opération à valider : Pièces détachées");
  assert.ok(field.message.includes("موقع الجزائر") && field.message.includes("أحمد"));
  assert.match(frenchNotificationCopy({ type: "cheque_due", label: "CH-01", days_left: 0 }).message, /aujourd’hui/);
  assert.match(frenchNotificationCopy({ type: "rental_ending", label: "آلة", days_left: -2 }).message, /2/);
});
