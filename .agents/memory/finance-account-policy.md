---
name: Financial account rules
description: Customer and partner account separation, purchase prices, and cheque settlement semantics.
---

Finance is organized into customers, partners, other work, and machinery. Each customer and partner has an independent account. A partner login may view only its own account, regardless of any other saved permission switches.

**Why:** The user explicitly requires separate accounts and a partner role that cannot see other partners.

**How to apply:** Enforce account ownership on the server for lists, details, summaries, and attachments, not merely in navigation. Machinery finances must use the original operational records, never duplicate manual entries.

Purchase unit cost remains required; selling price is optional. Partner interest is a percentage of each transaction's amount, editable per transaction, and presented separately from principal.

**Why:** The user explicitly selected these calculation rules when clarifying the request.

**How to apply:** An absent sale price must remain absent, not become zero. Do not introduce a time-based interest calculation or a profit-share interpretation.

Recording a non-cancelled cheque settles all customer invoices selected for it. Removing an invoice from a cheque, deleting the cheque, or cancelling it makes that invoice unpaid again unless another valid cheque settles it. Cheques never change cash-box balance.

**Why:** These are the user's stated settlement and cash-accounting rules; invoice settlement by cheque is not a cash receipt.

**How to apply:** Make cheque allocation changes atomic. Preserve existing supplier invoice history rather than silently reclassifying suppliers as customers when adding customer-linked purchases.
