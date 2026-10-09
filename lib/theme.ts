export const colors = {
  navy: "#07152F",
  blue: "#083C7A",
  royal: "#0555A8",
  yellow: "#F5B41E",
  background: "#F5F7FB",
  surface: "#FFFFFF",
  ink: "#14243B",
  muted: "#6B7F98",
  border: "#E4EAF1",
  green: "#14845A",
  greenSoft: "#EAF7F0",
  red: "#C4474D",
  redSoft: "#FFF0F0",
  amber: "#A76408",
  amberSoft: "#FFF5DE",
  violet: "#6D35C8",
};

export const formatDzd = (value: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} دج`;
