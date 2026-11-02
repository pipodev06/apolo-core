import React from "react";
import { Link } from "react-router-dom";
import { IconEye as Eye, IconPencil as Pencil, IconTrash as Trash2 } from "@tabler/icons-react";
import { ticketsService } from "../../services/ticketsService";
import { confirmar, notificarExito, notificarError } from "../../lib/alertas";
import { AccionesFila } from "../ui/acciones-fila";
import type { Ticket } from "../../types/ticket";

const claseIcono = "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary";

// Acciones de la card de un ticket: ver/editar/enviar a papelera, o en la
// Papelera restaurar/eliminar definitivo (AccionesFila).
export const AccionesTicket: React.FC<{ ticket: Ticket; soloPapelera: boolean; esAdmin: boolean }> = ({
  ticket,
  soloPapelera,
  esAdmin,
}) => {
  const enviarAPapelera = async () => {
    const ok = await confirmar({
      title: "Eliminar ticket",
      text: `¿Seguro que deseas eliminar ${ticket.code}? Se enviará a la papelera.`,
      confirmText: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    try {
      await ticketsService.delete(ticket.id);
      notificarExito("Enviado a la papelera");
    } catch {
      notificarError("Error al eliminar el ticket");
    }
  };

  const restaurar = async () => {
    try {
      await ticketsService.restaurar(ticket.id);
      notificarExito("Ticket restaurado");
    } catch {
      notificarError("Error al restaurar");
    }
  };

  const purgar = async () => {
    const ok = await confirmar({
      title: "Eliminar definitivamente",
      text: `${ticket.code} se borrará para siempre. Esta acción no se puede deshacer.`,
      confirmText: "Eliminar definitivo",
      danger: true,
    });
    if (!ok) return;
    try {
      await ticketsService.eliminarDefinitivo(ticket.id);
      notificarExito("Eliminado definitivamente");
    } catch {
      notificarError("Error al eliminar");
    }
  };

  if (soloPapelera) return <AccionesFila soloPapelera onRestaurar={restaurar} onPurgar={purgar} />;

  return (
    <>
      <Link to={`/tickets/${ticket.id}`} title="Ver detalle" className={claseIcono}>
        <Eye className="h-5 w-5" />
      </Link>
      {/* Editar/eliminar son de gestión: firestore.rules solo los permite a admins. */}
      {esAdmin && (
        <>
          <Link to={`/tickets/${ticket.id}/editar`} title="Editar" className={claseIcono}>
            <Pencil className="h-5 w-5" />
          </Link>
          <button
            onClick={enviarAPapelera}
            className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="Eliminar"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </>
      )}
    </>
  );
};
