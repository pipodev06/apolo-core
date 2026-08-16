import React from "react";
import { useAuth } from "../context/AuthContext";
import { IconSunrise as Sunrise, IconSun as Sun, IconMoon as Moon } from "@tabler/icons-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export const Home: React.FC = () => {
  const { user } = useAuth();
  const now = new Date();
  const hour = now.getHours();

  let greeting = "Buenas noches";
  let Icon = Moon;
  let message = "Que tengas un buen cierre de jornada.";

  if (hour >= 6 && hour < 12) {
    greeting = "Buenos días";
    Icon = Sunrise;
    message = "Esperamos que tengas un excelente día.";
  } else if (hour >= 12 && hour < 19) {
    greeting = "Buenas tardes";
    Icon = Sun;
    message = "Gracias por tu trabajo esta tarde.";
  }

  const fecha = format(now, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-2xl rounded-2xl border bg-card p-10 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-8 w-8" />
        </div>
        <p className="text-sm font-medium capitalize text-muted-foreground">{fecha}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {greeting}, <span className="text-primary">{user?.username}</span>
        </h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">{message}</p>
      </div>
    </div>
  );
};
