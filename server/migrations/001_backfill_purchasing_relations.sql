BEGIN;

INSERT INTO suppliers (name, normalized_name)
SELECT MIN(BTRIM(source.supplier)), LOWER(BTRIM(source.supplier))
FROM (
  SELECT supplier FROM inventory_items
  UNION ALL
  SELECT supplier FROM machinery_spare_parts
) AS source
WHERE NULLIF(BTRIM(source.supplier), '') IS NOT NULL
GROUP BY LOWER(BTRIM(source.supplier))
ON CONFLICT (normalized_name) DO NOTHING;

INSERT INTO purchase_invoices
  (supplier_id, invoice_number, normalized_invoice_number, invoice_date)
SELECT s.id, MIN(BTRIM(source.invoice_number)), LOWER(BTRIM(source.invoice_number)), MIN(source.invoice_date)
FROM (
  SELECT supplier, invoice_number, purchase_date AS invoice_date FROM inventory_items
  UNION ALL
  SELECT supplier, invoice_number, NULL::date AS invoice_date FROM machinery_spare_parts
) AS source
JOIN suppliers s ON s.normalized_name = LOWER(BTRIM(source.supplier))
WHERE NULLIF(BTRIM(source.supplier), '') IS NOT NULL
  AND NULLIF(BTRIM(source.invoice_number), '') IS NOT NULL
GROUP BY s.id, LOWER(BTRIM(source.invoice_number))
ON CONFLICT (supplier_id, normalized_invoice_number) DO NOTHING;

UPDATE inventory_items i
SET supplier_id = s.id
FROM suppliers s
WHERE i.supplier_id IS NULL
  AND NULLIF(BTRIM(i.supplier), '') IS NOT NULL
  AND s.normalized_name = LOWER(BTRIM(i.supplier));

UPDATE inventory_items i
SET invoice_id = pi.id
FROM purchase_invoices pi
WHERE i.invoice_id IS NULL
  AND i.supplier_id = pi.supplier_id
  AND NULLIF(BTRIM(i.invoice_number), '') IS NOT NULL
  AND pi.normalized_invoice_number = LOWER(BTRIM(i.invoice_number));

UPDATE machinery_spare_parts p
SET supplier_id = s.id
FROM suppliers s
WHERE p.supplier_id IS NULL
  AND NULLIF(BTRIM(p.supplier), '') IS NOT NULL
  AND s.normalized_name = LOWER(BTRIM(p.supplier));

UPDATE machinery_spare_parts p
SET invoice_id = pi.id
FROM purchase_invoices pi
WHERE p.invoice_id IS NULL
  AND p.supplier_id = pi.supplier_id
  AND NULLIF(BTRIM(p.invoice_number), '') IS NOT NULL
  AND pi.normalized_invoice_number = LOWER(BTRIM(p.invoice_number));

WITH unambiguous_matches AS (
  SELECT c.id, MIN(pi.id) AS invoice_id
  FROM cheques c
  JOIN purchase_invoices pi
    ON pi.normalized_invoice_number = LOWER(BTRIM(c.invoice_number))
  WHERE c.invoice_id IS NULL
    AND NULLIF(BTRIM(c.invoice_number), '') IS NOT NULL
  GROUP BY c.id
  HAVING COUNT(pi.id) = 1
)
UPDATE cheques c
SET invoice_id = matches.invoice_id
FROM unambiguous_matches matches
WHERE c.id = matches.id;

COMMIT;
