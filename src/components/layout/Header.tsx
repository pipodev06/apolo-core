import React from "react";
import { IconMenu2 as Menu } from "@tabler/icons-react";
import { useAuth } from "../../context/AuthContext";
import { NotificationBell } from "./NotificationBell";
import { Avatar, AvatarFallback } from "../ui/avatar";

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user } = useAuth();

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-8">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          aria-label="Abrir menú"
          className="cursor-pointer rounded-md p-2 text-gray-800 transition-colors hover:bg-gray-100 hover:text-gray-800 lg:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>
        <h2 className="hidden text-xl font-extrabold tracking-tight lg:block">
          <span className="text-gray-800">Sistema de Tickets</span>{" "}
          <span className="text-indigo-600">SIT</span>{" "}
          <span className="text-indigo-600">SambaNova AI</span>
        </h2>
      </div>

      <div className="flex items-center gap-2">
        <NotificationBell />
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-gray-800">{user?.username}</p>
            <p className="text-xs capitalize text-gray-800">{user?.role}</p>
          </div>
          <Avatar size="lg">
            <AvatarFallback>{user?.username.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
};
