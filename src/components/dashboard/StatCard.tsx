import React from "react";
import type { Icon as TablerIcon } from "@tabler/icons-react";
import { Card } from "../ui/card";
import { cn } from "../../lib/cn";

type Tone = "indigo" | "amber" | "purple" | "green" | "blue";

// Tonos categóricos de las métricas: una de las 2 excepciones de color fijo
// fuera de los tokens de shadcn (ver AGENTS.md).
const tones: Record<Tone, string> = {
  indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  purple: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
  green: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400",
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
};

export const StatCard: React.FC<{ title: string; value: number | string; icon: TablerIcon; tone: Tone }> = ({
  title,
  value,
  icon: Icon,
  tone,
}) => (
  <Card className="flex flex-col items-center gap-2 p-4 text-center">
    <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg", tones[tone])}>
      <Icon className="h-6 w-6" />
    </div>
    <div className="min-w-0">
      <p className="truncate text-xs font-medium text-muted-foreground">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  </Card>
);
