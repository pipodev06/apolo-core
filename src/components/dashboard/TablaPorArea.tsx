import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../ui/table";
import { Badge } from "../ui/badge";
import { fmtDuracion } from "../../lib/sla";
import type { FilaPorArea } from "../../lib/metricasDashboard";

// Resolución y SLA por área (solo vista de equipo).
export const TablaPorArea: React.FC<{ filas: FilaPorArea[]; promedioGeneral: number | null }> = ({
  filas,
  promedioGeneral,
}) => (
  <Card className="lg:col-span-2">
    <CardHeader>
      <CardTitle>Resolución y SLA por Área</CardTitle>
      <p className="text-sm text-muted-foreground">
        Tiempo promedio de resolución general: {fmtDuracion(promedioGeneral)}
      </p>
    </CardHeader>
    <CardContent>
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Tickets</TableHead>
              <TableHead>Terminados</TableHead>
              <TableHead>Tiempo prom. resolución</TableHead>
              <TableHead>Abiertos vencidos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((f, i) => (
              <TableRow key={f.area}>
                <TableCell>{i + 1}</TableCell>
                <TableCell className="font-medium">{f.area}</TableCell>
                <TableCell>{f.total}</TableCell>
                <TableCell>{f.terminados}</TableCell>
                <TableCell>{fmtDuracion(f.promedio)}</TableCell>
                <TableCell>
                  <Badge variant={f.vencidos > 0 ? "red" : "gray"}>{f.vencidos}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </CardContent>
  </Card>
);
