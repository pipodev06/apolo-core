import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { IconBell as Bell } from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Timestamp } from "firebase/firestore";
import { notificacionesService } from "../../services/notificacionesService";
import type { Notificacion } from "../../types/notificacion";
import type { FirestoreTimestamp } from "../../types/firestore";
import { useAuth } from "../../context/AuthContext";
import { useAccess } from "../../context/AccessContext";

function fmtRelativo(value: FirestoreTimestamp | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Timestamp ? value.toDate() : new Date(value);
  if (isNaN(d.getTime())) return "";
  return formatDistanceToNow(d, { locale: es, addSuffix: true });
}

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const { hasAccess } = useAccess();
  const navigate = useNavigate();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const puedeVerNotificaciones = !!user && hasAccess("notificaciones");

  useEffect(() => {
    if (!puedeVerNotificaciones || !user) return;
    return notificacionesService.watch(user.userId, setNotificaciones);
  }, [puedeVerNotificaciones, user]);

  useEffect(() => {
    if (!abierto) return;
    const handleClickFuera = (e: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener("mousedown", handleClickFuera);
    return () => document.removeEventListener("mousedown", handleClickFuera);
  }, [abierto]);

  const noLeidas = notificaciones.filter((n) => !n.leida);

  const handleClickNotificacion = async (n: Notificacion) => {
    setAbierto(false);
    if (!n.leida) await notificacionesService.marcarLeida(n.id);
    navigate(`/tickets/${n.ticketId}`);
  };

  const handleMarcarTodas = async () => {
    await notificacionesService.marcarTodasLeidas(noLeidas.map((n) => n.id));
  };

  if (!puedeVerNotificaciones) return null;

  return (
    <div className="relative" ref={contenedorRef}>
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-label="Notificaciones"
        className="relative cursor-pointer rounded-md p-2 text-gray-800 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-100"
      >
        <Bell className="h-5 w-5" />
        {noLeidas.length > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-semibold text-white">
            {noLeidas.length > 9 ? "9+" : noLeidas.length}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 z-20 mt-2 w-xl rounded-md border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Notificaciones</span>
            {noLeidas.length > 0 && (
              <button
                onClick={handleMarcarTodas}
                className="cursor-pointer text-xs font-medium text-indigo-600 hover:underline"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notificaciones.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-gray-800 dark:text-gray-100">Sin notificaciones.</p>
            )}
            {notificaciones.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClickNotificacion(n)}
                className={`block w-full cursor-pointer border-b border-gray-200 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-gray-800 ${
                  n.leida ? "" : "bg-indigo-600/5"
                }`}
              >
                <p className="text-xs font-semibold text-indigo-600">{n.ticketCode}</p>
                <p className="mt-0.5 text-sm text-gray-800 dark:text-gray-100">{n.mensaje}</p>
                <p className="mt-0.5 text-xs text-gray-800 dark:text-gray-100">{fmtRelativo(n.createdAt)}</p>
              </button>
            ))}
          </div>
          <Link
            to="/notificaciones"
            onClick={() => setAbierto(false)}
            className="block border-t border-gray-200 px-4 py-2.5 text-center text-xs font-medium text-indigo-600 transition-colors hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-gray-800"
          >
            Ver todas las notificaciones
          </Link>
        </div>
      )}
    </div>
  );
};
