import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

type ClassInput =
  | string
  | number
  | null
  | undefined
  | Record<string, boolean>
  | ClassInput[];

export function cn(...inputs: ClassInput[]): string {
  return twMerge(clsx(...inputs));
}

