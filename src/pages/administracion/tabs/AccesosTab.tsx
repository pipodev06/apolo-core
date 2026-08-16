import React, { useEffect, useState } from "react";
import { accessService } from "../../../services/accessService";
import { usersService } from "../../../services/usersService";
import type { User } from "../../../types/user";
import type { UserAccess, AccessSections } from "../../../types/access";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/ui/table";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { PageSpinner } from "../../../components/ui/spinner";
import { notificarExito, notificarError } from "../../../lib/alertas";
import { esAdmin, roleLabel } from "../../../lib/roles";

export const AccesosTab: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [accessList, setAccessList] = useState<UserAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const [usersData, accessData] = await Promise.all([
        usersService.getAll(),
        accessService.getAll()
      ]);
      setUsers(usersData);
      // Campo nuevo: los documentos existentes todavía no lo tienen — se
      // normaliza a "true" aquí para no apagarlo sin querer al guardar la
      // matriz por otro motivo (ver AccessContext, mismo criterio).
      setAccessList(accessData.map(acc => ({
        ...acc,
        sections: {
          ...acc.sections,
          notificaciones: acc.sections.notificaciones ?? true,
          papelera: acc.sections.papelera ?? true,
        },
      })));
    } catch {
      notificarError("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(fetchData);
  }, []);

  const handleToggle = (userId: string, section: keyof AccessSections) => {
    const user = users.find(u => u.id === userId);
    if (esAdmin(user?.role)) {
      notificarError("Los roles admin y super admin siempre tienen todos los accesos.");
      return;
    }

    setAccessList(prev => prev.map(acc => {
      if (acc.userId === userId) {
        return {
          ...acc,
          sections: {
            ...acc.sections,
            [section]: !acc.sections[section]
          }
        };
      }
      return acc;
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const promises = accessList.map(acc => {
        const user = users.find(u => u.id === acc.userId);
        if (esAdmin(user?.role)) return Promise.resolve();
        const sections = {
          dashboard: !!acc.sections?.dashboard,
          tickets: !!acc.sections?.tickets,
          personal: !!acc.sections?.personal,
          administracion: !!acc.sections?.administracion,
          notificaciones: !!acc.sections?.notificaciones,
          papelera: !!acc.sections?.papelera,
        };
        return accessService.updateAccess(acc.userId, sections);
      });
      await Promise.all(promises);
      notificarExito("Matriz de accesos actualizada");
    } catch {
      notificarError("Error al guardar los cambios");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">Matriz de Accesos por Sección</h3>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Usuario</TableHead>
            <TableHead className="text-center">Dashboard</TableHead>
            <TableHead className="text-center">Tickets</TableHead>
            <TableHead className="text-center">Personal</TableHead>
            <TableHead className="text-center">Administración</TableHead>
            <TableHead className="text-center">Notificaciones</TableHead>
            <TableHead className="text-center">Papelera</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
        {users.map((user, i) => {
          const access = accessList.find(acc => acc.userId === user.id);
          const elevado = esAdmin(user.role);

          return (
            <TableRow key={user.id}>
              <TableCell>{i + 1}</TableCell>
              <TableCell className="font-medium">
                {user.username}{" "}
                {elevado && <span className="ml-1 text-xs font-bold text-indigo-600">({roleLabel(user.role)})</span>}
              </TableCell>
              <TableCell className="text-center">
                <Checkbox
                  className="mx-auto"
                  checked={elevado || access?.sections.dashboard || false}
                  disabled={elevado}
                  onCheckedChange={() => handleToggle(user.id, "dashboard")}
                />
              </TableCell>
              <TableCell className="text-center">
                <Checkbox
                  className="mx-auto"
                  checked={elevado || access?.sections.tickets || false}
                  disabled={elevado}
                  onCheckedChange={() => handleToggle(user.id, "tickets")}
                />
              </TableCell>
              <TableCell className="text-center">
                <Checkbox
                  className="mx-auto"
                  checked={elevado || access?.sections.personal || false}
                  disabled={elevado}
                  onCheckedChange={() => handleToggle(user.id, "personal")}
                />
              </TableCell>
              <TableCell className="text-center">
                <Checkbox
                  className="mx-auto"
                  checked={elevado || access?.sections.administracion || false}
                  disabled={elevado}
                  onCheckedChange={() => handleToggle(user.id, "administracion")}
                />
              </TableCell>
              <TableCell className="text-center">
                <Checkbox
                  className="mx-auto"
                  checked={elevado || access?.sections.notificaciones || false}
                  disabled={elevado}
                  onCheckedChange={() => handleToggle(user.id, "notificaciones")}
                />
              </TableCell>
              <TableCell className="text-center">
                <Checkbox
                  className="mx-auto"
                  checked={elevado || access?.sections.papelera || false}
                  disabled={elevado}
                  onCheckedChange={() => handleToggle(user.id, "papelera")}
                />
              </TableCell>
            </TableRow>
          );
        })}
        </TableBody>
      </Table>
      </div>

      <div className="pt-6 border-t flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar Matriz"}
        </Button>
      </div>
    </div>
  );
};
