import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | undefined | null): string {
  const num = Math.round(Number(amount) || 0);
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatNumber(amount: number | string | undefined | null): string {
  const num = Number(amount) || 0;
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
