import React, { useState } from "react";
import { IconMenu2 as Menu, IconKey as Key } from "@tabler/icons-react";
import { useAuth } from "../../context/AuthContext";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { EditarPasswordModal } from "../admin/EditarPasswordModal";

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user } = useAuth();
  const [passwordOpen, setPasswordOpen] = useState(false);

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4 lg:px-8">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          aria-label="Abrir menú"
          className="cursor-pointer rounded-md p-2 text-foreground transition-colors hover:bg-muted lg:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <button
          onClick={() => setPasswordOpen(true)}
          aria-label="Cambiar contraseña"
          title="Cambiar contraseña"
          className="cursor-pointer rounded-md p-2 text-foreground transition-colors hover:bg-muted"
        >
          <Key className="h-5 w-5" />
        </button>
        <NotificationBell />
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-foreground">{user?.username}</p>
            <p className="text-xs capitalize text-foreground">{user?.role}</p>
          </div>
          <Avatar size="lg">
            <AvatarFallback>{user?.username.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </div>
      </div>

      <EditarPasswordModal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        user={user ? { id: user.userId, username: user.username } : null}
        propio
      />
    </header>
  );
};
