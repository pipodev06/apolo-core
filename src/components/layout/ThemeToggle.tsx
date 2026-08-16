import React from "react";
import { IconSun as Sun, IconMoon as Moon } from "@tabler/icons-react";
import { useTheme } from "../../context/ThemeContext";

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="cursor-pointer rounded-md p-2 text-gray-800 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-100"
    >
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
};
