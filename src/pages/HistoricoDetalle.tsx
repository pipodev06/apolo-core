import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IconArrowLeft as ArrowLeft, IconEye as Eye } from "@tabler/icons-react";
import { empleadosService } from "../services/empleadosService";
import { useTickets } from "../context/TicketsContext";
import type { Empleado } from "../types/empleado";
import type { TicketStatus } from "../types/ticket";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Button } from "../components/ui/button";
import { PageSpinner } from "../components/ui/spinner";
import { StatusBadge } from "../components/tickets/StatusBadge";
import { UrgencyBadge } from "../components/tickets/UrgencyBadge";
import { notificarError } from "../lib/alertas";
import { fmtFechaCorta } from "../lib/fecha";

const ESTADOS: TicketStatus[] = ["pendiente", "asignado", "en_proceso", "terminado"];

export const HistoricoDetalle: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tickets, loading: ticketsLoading } = useTickets();
  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    empleadosService
      .getAll()
      .then((lista) => {
        const encontrado = lista.find((e) => e.id === id) ?? null;
        if (!encontrado) {
          notificarError("Empleado no encontrado");
          navigate("/historico");
          return;
        }
        setEmpleado(encontrado);
      })
      .catch(() => notificarError("Error al cargar el empleado"))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const ticketsEmpleado = tickets.filter((t) => t.assignedTo === id);

  const conteoPorEstado = ESTADOS.reduce(
    (acc, estado) => {
      acc[estado] = ticketsEmpleado.filter((t) => t.status === estado).length;
      return acc;
    },
    {} as Record<TicketStatus, number>
  );

  const cargando = loading || ticketsLoading;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Button variant="ghost" onClick={() => navigate("/historico")}>
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Button>

      {cargando ? (
        <PageSpinner />
      ) : empleado ? (
        <>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{empleado.nombre}</h1>
            <p className="text-sm text-muted-foreground">
              {empleado.cargo || "-"} · {empleado.area || "-"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ESTADOS.map((estado) => (
              <div key={estado} className="rounded-lg border bg-card p-3 text-center shadow-sm">
                <p className="text-2xl font-bold">{conteoPorEstado[estado]}</p>
                <div className="mt-1 flex justify-center">
                  <StatusBadge status={estado} />
                </div>
              </div>
            ))}
          </div>

          {ticketsEmpleado.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-card py-12 text-center">
              <h3 className="text-lg font-medium">Sin tickets asignados.</h3>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Urgencia</TableHead>
                    <TableHead>Actualizado</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ticketsEmpleado.map((t, i) => (
                    <TableRow key={t.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-medium">{t.code}</TableCell>
                      <TableCell>{t.title}</TableCell>
                      <TableCell>
                        <StatusBadge status={t.status} />
                      </TableCell>
                      <TableCell>
                        <UrgencyBadge urgency={t.urgency} />
                      </TableCell>
                      <TableCell>{fmtFechaCorta(t.updatedAt)}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/tickets/${t.id}`)}>
                          <Eye className="h-4 w-4" />
                          Ver Ticket
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};
