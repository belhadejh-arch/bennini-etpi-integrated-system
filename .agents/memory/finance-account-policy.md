---
name: Financial account rules
description: Customer and partner account separation, purchase prices, and cheque settlement semantics.
---

Finance is organized into customers, partners, other work, and machinery. Each customer and partner has an independent account. A partner login may view only its own account, regardless of any other saved permission switches.

**Why:** The user explicitly requires separate accounts and a partner role that cannot see other partners.

**How to apply:** Enforce account ownership on the server for lists, details, summaries, and attachments, not merely in navigation. Machinery finances must use the original operational records, never duplicate manual entries.

New purchase entry uses total purchase and total sale instead of quantities and unit prices. Keep the supplier and link each new purchase to an existing finance customer by ID. Profit is sale total minus purchase total, readonly and green. The customer's account must show every purchase's information, paid/unpaid status, and aggregate purchase, sale, profit, paid and outstanding totals.

**Why:** The user explicitly replaced the former unit-price purchase form with this customer-linked totals workflow.

**How to apply:** Provide searchable customer selection and inline registration without losing the purchase draft. Edits, reassignment, deletion and payment changes must recalculate the affected customer accounts. Preserve historical stock quantities and the original valuation of legacy invoices; do not silently reinterpret existing cheque debts. Historical unspecified selling prices remain unspecified.

Partner interest is a percentage of each transaction's amount, editable per transaction, and presented separately from principal.

**Why:** The user explicitly selected per-transaction interest rather than time-based interest or profit sharing.

**How to apply:** Do not introduce a time-based interest calculation or a profit-share interpretation.

Recording a non-cancelled cheque settles all customer invoices selected for it. Removing an invoice from a cheque, deleting the cheque, or cancelling it makes that invoice unpaid again unless another valid cheque settles it. Cheques never change cash-box balance.

**Why:** These are the user's stated settlement and cash-accounting rules; invoice settlement by cheque is not a cash receipt.

**How to apply:** Make cheque allocation changes atomic. Preserve existing supplier invoice history rather than silently reclassifying suppliers as customers when adding customer-linked purchases.

Direct paid/unpaid tracking for purchases is separate from cash-box movements and must not duplicate an active cheque settlement.

**Why:** Customer settlement tracking must not invent a cash transaction or charge a settled invoice twice.

**How to apply:** An active cheque governs settlement of its purchases until the link is removed; do not turn cheque payment into a permanent direct-paid flag when saving unrelated edits.
