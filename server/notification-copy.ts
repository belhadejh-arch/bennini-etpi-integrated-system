// Translate system-generated notification copy, never user-written names, sites or reasons.
export function frenchNotificationCopy(row: Record<string, unknown>) {
  const label = String(row.label ?? "");
  const detail = String(row.detail ?? "");
  const number = (value: unknown) => new Intl.NumberFormat("fr-DZ").format(Number(value ?? 0));
  const category = ({
    "مازوت": "Gasoil", "قطع غيار": "Pièces détachées", "مشتريات": "Achats",
    "إصلاح آلية": "Réparation d’engin", "مصاريف أخرى": "Autres dépenses",
  } as Record<string, string>)[label] ?? label;
  const days = Number(row.days_left);
  switch (row.type) {
    case "cheque_due":
      return { title: `Échéance du chèque ${label}`,
        message: days < 0 ? `En retard de ${number(Math.abs(days))} jour(s)` : days === 0 ? "Échéance aujourd’hui" : `Échéance dans ${number(days)} jour(s)` };
    case "rental_ending":
      return { title: `Fin de location : ${label}`,
        message: days < 0 ? `Terminée depuis ${number(Math.abs(days))} jour(s)` : days === 0 ? "Se termine aujourd’hui" : `Se termine dans ${number(days)} jour(s)` };
    case "new_expense":
      return { title: `Nouvelle dépense : ${label}`, message: detail || "Nouvelle opération de dépense enregistrée." };
    case "field_operation":
      return { title: `Nouvelle opération de terrain de ${String(row.created_by_name ?? "")}`, message: `${category} · ${detail}` };
    case "field_review":
      return { title: `Opération à valider : ${category}`, message: `Chantier : ${detail} · Envoyée par ${String(row.created_by_name ?? "")}` };
    case "low_inventory":
      return { title: `Stock faible : ${label}`, message: `Reste ${number(row.remaining_quantity)} sur ${number(row.quantity)}.` };
    case "driver_month_anniversary":
      return { title: `Mois de travail du chauffeur ${label}`,
        message: `Le chauffeur ${label} de l’engin ${detail} termine un mois de travail dans 5 jours.` };
    default:
      return { title: `Stock faible de pièce : ${label}`, message: `Reste ${number(row.stock_quantity)} sur ${number(row.quantity)}.` };
  }
}
