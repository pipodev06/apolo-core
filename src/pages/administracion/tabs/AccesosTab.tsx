import React, { useEffect, useState } from "react";
import { accessService } from "../../../services/accessService";
import { usersService } from "../../../services/usersService";
import type { User } from "../../../types/user";
import type { UserAccess, AccessSections } from "../../../types/access";
import { TablaCard, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/ui/table";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { PageSpinner } from "../../../components/ui/spinner";
import { notificarExito, notificarError } from "../../../lib/alertas";
import { esAdmin, esSuperAdmin, roleLabel } from "../../../lib/roles";
import { useAuth } from "../../../context/AuthContext";

export const AccesosTab: React.FC = () => {
  const { user: currentUser } = useAuth();
  const soySuperAdmin = esSuperAdmin(currentUser?.role);
  // Los accesos de una cuenta protegida solo los cambia un super_admin
  // (firestore.rules): para un admin se muestran pero no se pueden tocar.
  const bloqueadaParaMi = (u?: User) => !!u?.protegida && !soySuperAdmin;
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
          papelera: acc.sections.papelera ?? false,
          subirImagenes: acc.sections.subirImagenes ?? false,
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

  // "Subir imágenes" es el único permiso que también aplica a un admin, y
  // ese solo lo cambia un super_admin (firestore.rules). El super_admin
  // siempre puede subir.
  const editableParaMi = (u: User | undefined, section: keyof AccessSections) =>
    section === "subirImagenes" && u?.role === "admin" ? soySuperAdmin : !esAdmin(u?.role) && !bloqueadaParaMi(u);

  const handleToggle = (userId: string, section: keyof AccessSections) => {
    const user = users.find(u => u.id === userId);
    if (user?.role === "admin" && section === "subirImagenes" && !soySuperAdmin) {
      notificarError("Solo un super admin puede cambiar este permiso a un admin.");
      return;
    }
    if (esAdmin(user?.role) && !editableParaMi(user, section)) {
      notificarError("Los roles admin y super admin siempre tienen todos los accesos.");
      return;
    }
    if (bloqueadaParaMi(user)) {
      notificarError("Cuenta protegida: solo un super admin puede cambiar sus accesos.");
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
        // De un admin solo importa "subirImagenes", y solo lo guarda un super_admin.
        const guardable = user?.role === "admin" ? soySuperAdmin : !esAdmin(user?.role) && !bloqueadaParaMi(user);
        if (!guardable) return Promise.resolve();
        const sections = {
          dashboard: !!acc.sections?.dashboard,
          tickets: !!acc.sections?.tickets,
          personal: !!acc.sections?.personal,
          administracion: !!acc.sections?.administracion,
          notificaciones: !!acc.sections?.notificaciones,
          papelera: !!acc.sections?.papelera,
          historico: !!acc.sections?.historico,
          subirImagenes: !!acc.sections?.subirImagenes,
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
        <h3 className="text-lg font-medium">Matriz de Accesos por Sección</h3>
      </div>

      <TablaCard>
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
            <TableHead className="text-center">Histórico</TableHead>
            <TableHead className="text-center">Subir imágenes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
        {users.map((user, i) => {
          const access = accessList.find(acc => acc.userId === user.id);
          const elevado = esAdmin(user.role);
          const bloqueado = elevado || bloqueadaParaMi(user);

          return (
            <TableRow key={user.id}>
              <TableCell>{i + 1}</TableCell>
              <TableCell className="font-medium">
                {user.username}{" "}
                {elevado && <span className="ml-1 text-sm font-bold text-primary">({roleLabel(user.role)})</span>}
              </TableCell>
              <TableCell className="text-center">
                <Checkbox
                  className="mx-auto"
                  checked={elevado || access?.sections.dashboard || false}
                  disabled={bloqueado}
                  onCheckedChange={() => handleToggle(user.id, "dashboard")}
                />
              </TableCell>
              <TableCell className="text-center">
                <Checkbox
                  className="mx-auto"
                  checked={elevado || access?.sections.tickets || false}
                  disabled={bloqueado}
                  onCheckedChange={() => handleToggle(user.id, "tickets")}
                />
              </TableCell>
              <TableCell className="text-center">
                <Checkbox
                  className="mx-auto"
                  checked={elevado || access?.sections.personal || false}
                  disabled={bloqueado}
                  onCheckedChange={() => handleToggle(user.id, "personal")}
                />
              </TableCell>
              <TableCell className="text-center">
                <Checkbox
                  className="mx-auto"
                  checked={elevado || access?.sections.administracion || false}
                  disabled={bloqueado}
                  onCheckedChange={() => handleToggle(user.id, "administracion")}
                />
              </TableCell>
              <TableCell className="text-center">
                <Checkbox
                  className="mx-auto"
                  checked={elevado || access?.sections.notificaciones || false}
                  disabled={bloqueado}
                  onCheckedChange={() => handleToggle(user.id, "notificaciones")}
                />
              </TableCell>
              <TableCell className="text-center">
                <Checkbox
                  className="mx-auto"
                  checked={elevado || access?.sections.papelera || false}
                  disabled={bloqueado}
                  onCheckedChange={() => handleToggle(user.id, "papelera")}
                />
              </TableCell>
              <TableCell className="text-center">
                <Checkbox
                  className="mx-auto"
                  checked={elevado || access?.sections.historico || false}
                  disabled={bloqueado}
                  onCheckedChange={() => handleToggle(user.id, "historico")}
                />
              </TableCell>
              <TableCell className="text-center">
                <Checkbox
                  className="mx-auto"
                  checked={esSuperAdmin(user.role) || access?.sections.subirImagenes || false}
                  disabled={!editableParaMi(user, "subirImagenes")}
                  onCheckedChange={() => handleToggle(user.id, "subirImagenes")}
                />
              </TableCell>
            </TableRow>
          );
        })}
        </TableBody>
      </TablaCard>

      <div className="pt-6 border-t flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar Matriz"}
        </Button>
      </div>
    </div>
  );
};
