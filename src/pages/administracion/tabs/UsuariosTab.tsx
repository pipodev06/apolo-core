import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usersService } from "../../../services/usersService";
import type { User } from "../../../types/user";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { SimplePagination } from "../../../components/ui/pagination";
import { PageSpinner } from "../../../components/ui/spinner";
import { IconPower as Power, IconTrash as Trash2, IconShield as Shield, IconUser as UserIcon, IconPlus as Plus, IconPencil as Pencil, IconRestore as RotateCcw, IconSearch as Search, IconFilterOff as FilterX } from "@tabler/icons-react";
import { confirmar, notificarExito, notificarError } from "../../../lib/alertas";
import { esAdmin, esSuperAdmin, roleLabel } from "../../../lib/roles";
import { cn } from "../../../lib/cn";
import { useAuth } from "../../../context/AuthContext";
import { NuevoUsuarioModal } from "../../../components/admin/NuevoUsuarioModal";
import { EditarPasswordModal } from "../../../components/admin/EditarPasswordModal";
import { EditarUsuarioModal } from "../../../components/admin/EditarUsuarioModal";

const PAGE_SIZE = 10;

interface Props {
  soloPapelera?: boolean;
}

export const UsuariosTab: React.FC<Props> = ({ soloPapelera = false }) => {
  const { user: currentUser } = useAuth();
  const puedeEditarUsername = esSuperAdmin(currentUser?.role);

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNuevo, setShowNuevo] = useState(false);
  const [editandoPassword, setEditandoPassword] = useState<User | null>(null);
  const [editandoUsuario, setEditandoUsuario] = useState<User | null>(null);
  const [page, setPage] = useState(1);

  // Borrador: lo que el usuario va eligiendo antes de aplicar.
  // dCampo: "" = todos los campos, o "rol" | "estado" para acotar la búsqueda a ese campo.
  const [dQuery, setDQuery] = useState("");
  const [dCampo, setDCampo] = useState("");

  // Aplicado: lo que realmente filtra la lista, se actualiza con "Filtrar".
  const [query, setQuery] = useState("");
  const [fCampo, setFCampo] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = soloPapelera ? await usersService.listarPapelera() : await usersService.getAll();
      setUsers(data);
    } catch {
      notificarError("Error al cargar los usuarios");
    } finally {
      setLoading(false);
    }
  }, [soloPapelera]);

  useEffect(() => {
    Promise.resolve().then(fetchUsers);
  }, [fetchUsers]);

  const handleToggleActive = async (id: string, currentStatus: boolean, role: string) => {
    if (esSuperAdmin(role)) {
      notificarError("No puedes desactivar al super administrador.");
      return;
    }

    try {
      await usersService.toggleActive(id, currentStatus);
      notificarExito("Estado de usuario actualizado");
      fetchUsers();
    } catch {
      notificarError("Error al actualizar");
    }
  };

  const handleDelete = async (user: User) => {
    const ok = await confirmar({
      title: "Eliminar usuario",
      text: `¿Seguro que deseas eliminar a ${user.username}? Se enviará a la papelera.`,
      confirmText: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    try {
      await usersService.delete(user.id);
      notificarExito("Enviado a la papelera");
      fetchUsers();
    } catch {
      notificarError("Error al eliminar");
    }
  };

  const restaurar = async (user: User) => {
    try {
      await usersService.restaurar(user.id);
      notificarExito("Usuario restaurado");
      fetchUsers();
    } catch {
      notificarError("Error al restaurar");
    }
  };

  const purgar = async (user: User) => {
    const ok = await confirmar({
      title: "Eliminar definitivamente",
      text: `${user.username} se borrará para siempre. Esta acción no se puede deshacer.`,
      confirmText: "Eliminar definitivo",
      danger: true,
    });
    if (!ok) return;
    try {
      await usersService.eliminarDefinitivo(user.id);
      notificarExito("Eliminado definitivamente");
      fetchUsers();
    } catch {
      notificarError("Error al eliminar");
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (!q) return true;
      if (fCampo === "rol") return roleLabel(u.role).toLowerCase().includes(q);
      if (fCampo === "estado") return (u.active ? "activo" : "inactivo").includes(q);
      return u.username.toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
    });
  }, [users, query, fCampo]);

  const hayFiltrosActivos = !!query;

  const aplicarFiltros = () => {
    setQuery(dQuery);
    setFCampo(dCampo);
  };

  const limpiarFiltros = () => {
    setDQuery("");
    setDCampo("");
    setQuery("");
    setFCampo("");
  };

  // Reinicia a la página 1 cuando cambian los filtros aplicados. Se ajusta
  // durante el render (patrón de React para "resetear estado cuando cambia
  // una dependencia"), no en un efecto: evita un render extra innecesario.
  const filtrosKey = `${query}|${fCampo}`;
  const [prevFiltrosKey, setPrevFiltrosKey] = useState(filtrosKey);
  if (filtrosKey !== prevFiltrosKey) {
    setPrevFiltrosKey(filtrosKey);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paginados = useMemo(
    () => filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE),
    [filtered, pageSafe]
  );

  return (
    <div className="space-y-2">
      {!soloPapelera && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">Gestión de Usuarios</h3>
          <Button size="sm" onClick={() => setShowNuevo(true)}>
            <Plus className="h-4 w-4" />
            Nuevo Usuario
          </Button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div>
          <Select
            items={[
              { value: "__all__", label: "Todos los campos" },
              { value: "rol", label: "Rol" },
              ...(!soloPapelera ? [{ value: "estado", label: "Estado" }] : []),
            ]}
            value={dCampo || "__all__"}
            onValueChange={(v) => setDCampo(v === "__all__" || v == null ? "" : v)}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="__all__">Todos los campos</SelectItem>
                <SelectItem value="rol">Rol</SelectItem>
                {!soloPapelera && <SelectItem value="estado">Estado</SelectItem>}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-55 flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-800 dark:text-gray-100" />
            <Input
              type="text"
              value={dQuery}
              onChange={(e) => setDQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && aplicarFiltros()}
              placeholder="Buscar..."
              className="pl-9"
            />
          </div>
        </div>
        <Button onClick={aplicarFiltros}>
          <Search className="h-4 w-4" />
          Buscar
        </Button>
        {hayFiltrosActivos && (
          <Button variant="outline" onClick={limpiarFiltros} title="Limpiar filtros">
            <FilterX className="h-4 w-4" />
            Limpiar
          </Button>
        )}
      </div>

      {loading ? (
        <PageSpinner />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-white py-12 text-center dark:border-gray-800 dark:bg-gray-900">
          <UserIcon className="mx-auto mb-4 h-12 w-12 text-gray-800/40 dark:text-gray-100/40" />
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">
            {soloPapelera ? "Papelera vacía" : "Sin usuarios"}
          </h3>
          <p className="text-gray-800 dark:text-gray-100">
            {soloPapelera
              ? "No hay usuarios eliminados."
              : hayFiltrosActivos
              ? "Ningún usuario coincide con la búsqueda."
              : "Crea el primer usuario para empezar."}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {paginados.map((user, i) => (
              <TableRow key={user.id}>
                <TableCell>{(pageSafe - 1) * PAGE_SIZE + i + 1}</TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                      <UserIcon className="h-4 w-4 text-gray-800 dark:text-gray-100" />
                    </div>
                    <span className="font-medium">{user.username}</span>
                  </div>
                </TableCell>
                <TableCell className="text-gray-800 dark:text-gray-100">{user.email || "-"}</TableCell>
                <TableCell>
                  <div className="flex items-center">
                    {esAdmin(user.role) ? (
                      <Shield className={cn("mr-1 h-4 w-4", esSuperAdmin(user.role) ? "text-indigo-600" : "text-gray-800 dark:text-gray-100")} />
                    ) : (
                      <UserIcon className="mr-1 h-4 w-4 text-gray-800 dark:text-gray-100" />
                    )}
                    <span>{roleLabel(user.role)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {soloPapelera ? (
                    <Badge variant="red" dot>
                      Eliminado
                    </Badge>
                  ) : (
                    <Badge variant={user.active ? "green" : "red"} dot>
                      {user.active ? "Activo" : "Inactivo"}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {soloPapelera ? (
                      <>
                        <button
                          onClick={() => restaurar(user)}
                          className="cursor-pointer rounded-md p-1.5 text-gray-800 transition-colors hover:bg-green-500/10 hover:text-green-600 dark:text-gray-100"
                          title="Restaurar"
                        >
                          <RotateCcw className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => purgar(user)}
                          disabled={esSuperAdmin(user.role)}
                          className="cursor-pointer rounded-md p-1.5 text-gray-800 transition-colors hover:bg-red-600/10 hover:text-red-600 disabled:cursor-not-allowed disabled:text-gray-800/40 disabled:hover:bg-transparent dark:text-gray-100 dark:disabled:text-gray-100/40"
                          title="Eliminar definitivo"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleToggleActive(user.id, user.active, user.role)}
                          className={cn(
                            "cursor-pointer rounded-md p-1.5 transition-colors",
                            user.active
                              ? "text-gray-800 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                              : "text-gray-800 hover:bg-green-500/10 hover:text-green-600 dark:text-gray-100"
                          )}
                          title={user.active ? "Desactivar" : "Activar"}
                        >
                          <Power className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => setEditandoUsuario(user)}
                          className="cursor-pointer rounded-md p-1.5 text-gray-800 transition-colors hover:bg-gray-100 hover:text-indigo-600 dark:text-gray-100 dark:hover:bg-gray-800"
                          title="Editar"
                        >
                          <Pencil className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          disabled={esSuperAdmin(user.role)}
                          className="cursor-pointer rounded-md p-1.5 text-gray-800 transition-colors hover:bg-red-600/10 hover:text-red-600 disabled:cursor-not-allowed disabled:text-gray-800/40 disabled:hover:bg-transparent dark:text-gray-100 dark:disabled:text-gray-100/40"
                          title="Eliminar"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            </TableBody>
          </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-end">
              <SimplePagination page={pageSafe} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </>
      )}

      {!soloPapelera && (
        <>
          <NuevoUsuarioModal open={showNuevo} onClose={() => setShowNuevo(false)} onCreated={fetchUsers} />
          <EditarPasswordModal
            open={!!editandoPassword}
            onClose={() => setEditandoPassword(null)}
            user={editandoPassword}
          />
          <EditarUsuarioModal
            open={!!editandoUsuario}
            onClose={() => setEditandoUsuario(null)}
            onUpdated={fetchUsers}
            onCambiarContrasena={() => editandoUsuario && setEditandoPassword(editandoUsuario)}
            user={editandoUsuario}
            puedeEditarUsername={puedeEditarUsername}
          />
        </>
      )}
    </div>
  );
};
