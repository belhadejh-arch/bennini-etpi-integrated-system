export const colors = {
  navy: "#07152F",
  deepBlue: "#05326F",
  blue: "#083C7A",
  royal: "#0555A8",
  yellow: "#F5B41E",
  grayBlue: "#66839E",
  lightBlue: "#7FA9C7",
  lightBeige: "#E4D69A",
  background: "#F5F7F8",
  surface: "#FCFBF6",
  ink: "#07152F",
  muted: "#66839E",
  border: "#DCE5EA",
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
