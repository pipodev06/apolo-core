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
      <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600">
          <Icon className="h-8 w-8" />
        </div>
        <p className="text-sm font-medium capitalize text-gray-800">{fecha}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-800 sm:text-4xl">
          {greeting}, <span className="text-indigo-600">{user?.username}</span>
        </h1>
        <p className="mx-auto mt-3 max-w-md text-gray-800">{message}</p>
      </div>
    </div>
  );
};
