import React, { useMemo, useState } from "react";
import { usersService } from "../../../services/usersService";
import type { User } from "../../../types/user";
import { TablaCard, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { FiltroBuscarPor, type BusquedaPorCampo } from "../../../components/ui/filtro-buscar-por";
import { SimplePagination } from "../../../components/ui/pagination";
import { PageSpinner } from "../../../components/ui/spinner";
import { EstadoVacio } from "../../../components/ui/estado-vacio";
import { IconShield as Shield, IconUser as UserIcon, IconPlus as Plus } from "@tabler/icons-react";
import { confirmar, notificarExito, notificarError } from "../../../lib/alertas";
import { esAdmin, esSuperAdmin, roleLabel } from "../../../lib/roles";
import { cn } from "../../../lib/cn";
import { useAuth } from "../../../context/AuthContext";
import { NuevoUsuarioModal } from "../../../components/admin/NuevoUsuarioModal";
import { EditarPasswordModal } from "../../../components/admin/EditarPasswordModal";
import { EditarUsuarioModal } from "../../../components/admin/EditarUsuarioModal";
import { AccionesFila } from "../../../components/ui/acciones-fila";
import { usePaginacion } from "../../../lib/usePaginacion";
import { useListaConPapelera } from "../../../lib/useListaConPapelera";
import { useAdminDatos } from "../../../context/AdminDatosContext";

const PAGE_SIZE = 10;
const SIN_USUARIOS: User[] = [];

interface Props {
  soloPapelera?: boolean;
}

export const UsuariosTab: React.FC<Props> = ({ soloPapelera = false }) => {
  const { user: currentUser } = useAuth();
  const soySuperAdmin = esSuperAdmin(currentUser?.role);
  const puedeEditarUsername = soySuperAdmin;
  // Lo mismo que exigen firestore.rules y las Functions: un admin solo
  // gestiona cuentas "usuario" no protegidas (las admin y super_admin, solo
  // un super_admin; su propia cuenta la puede editar sin cambiarse el rol).
  // Se deshabilita en la UI para no ofrecer acciones que después fallan.
  const motivoBloqueo = (u: User) => {
    if (soySuperAdmin || u.id === currentUser?.userId) return undefined;
    if (esAdmin(u.role)) return "Solo un super admin puede modificar cuentas de administrador";
    if (u.protegida) return "Cuenta protegida: solo un super admin puede modificarla";
    return undefined;
  };

  // En Administración, las cuentas vienen del listener de AdminDatosProvider;
  // en la Papelera (fuera de Administración) se piden aparte.
  const adminDatos = useAdminDatos();
  const {
    items: users,
    loading,
    recargar: fetchUsers,
  } = useListaConPapelera(
    soloPapelera,
    { lista: adminDatos?.users ?? SIN_USUARIOS, listo: !!adminDatos?.listo },
    usersService.listarPapelera
  );
  const [showNuevo, setShowNuevo] = useState(false);
  const [editandoPassword, setEditandoPassword] = useState<User | null>(null);
  const [editandoUsuario, setEditandoUsuario] = useState<User | null>(null);

  // Búsqueda aplicada (el borrador vive en FiltroBuscarPor). campo: "" = todos,
  // o "rol" | "estado" para acotar la búsqueda a ese campo.
  const [busqueda, setBusqueda] = useState<BusquedaPorCampo>({ query: "", campo: "" });

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
    const q = busqueda.query.trim().toLowerCase();
    return users.filter((u) => {
      if (!q) return true;
      if (busqueda.campo === "rol") return roleLabel(u.role).toLowerCase().includes(q);
      if (busqueda.campo === "estado") return (u.active ? "activo" : "inactivo").includes(q);
      return u.username.toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
    });
  }, [users, busqueda]);

  const hayFiltrosActivos = !!busqueda.query;
  const { pagina, totalPages, paginados, numero, setPage } = usePaginacion(
    filtered,
    PAGE_SIZE,
    `${busqueda.query}|${busqueda.campo}`
  );

  return (
    <div className="space-y-2">
      {!soloPapelera && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Gestión de Usuarios</h3>
          <Button size="sm" onClick={() => setShowNuevo(true)}>
            <Plus className="h-4 w-4" />
            Nuevo Usuario
          </Button>
        </div>
      )}

      <FiltroBuscarPor
        campos={[{ value: "rol", label: "Rol" }, ...(!soloPapelera ? [{ value: "estado", label: "Estado" }] : [])]}
        activo={hayFiltrosActivos}
        onAplicar={setBusqueda}
      />

      {loading ? (
        <PageSpinner />
      ) : filtered.length === 0 ? (
        <EstadoVacio
          icono={UserIcon}
          titulo="Sin usuarios"
          detalle="Crea el primer usuario para empezar."
          soloPapelera={soloPapelera}
          textoPapelera="No hay usuarios eliminados."
          conFiltros={hayFiltrosActivos}
          textoFiltros="Ningún usuario coincide con la búsqueda."
        />
      ) : (
        <>
          <TablaCard>
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
                <TableCell>{numero(i)}</TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="font-medium">{user.username}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{user.email || "-"}</TableCell>
                <TableCell>
                  <div className="flex items-center">
                    {esAdmin(user.role) ? (
                      <Shield className={cn("mr-1 h-4 w-4", esSuperAdmin(user.role) ? "text-primary" : "text-muted-foreground")} />
                    ) : (
                      <UserIcon className="mr-1 h-4 w-4 text-muted-foreground" />
                    )}
                    <span>{roleLabel(user.role)}</span>
                    {user.protegida && (
                      <Badge variant="gray" className="ml-2">
                        Protegida
                      </Badge>
                    )}
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
                  <AccionesFila
                    soloPapelera={soloPapelera}
                    onRestaurar={() => restaurar(user)}
                    onPurgar={() => purgar(user)}
                    activo={user.active}
                    onToggle={() => handleToggleActive(user.id, user.active, user.role)}
                    onEditar={() => setEditandoUsuario(user)}
                    onEliminar={() => handleDelete(user)}
                    bloquearBorrado={esSuperAdmin(user.role)}
                    bloqueadoMotivo={motivoBloqueo(user)}
                  />
                </TableCell>
              </TableRow>
            ))}
            </TableBody>
          </TablaCard>

          {totalPages > 1 && (
            <div className="flex justify-end">
              <SimplePagination page={pagina} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </>
      )}

      {!soloPapelera && (
        <>
          <NuevoUsuarioModal
            open={showNuevo}
            onClose={() => setShowNuevo(false)}
            onCreated={fetchUsers}
            esSuperAdminActual={soySuperAdmin}
          />
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
            esSuperAdminActual={soySuperAdmin}
          />
        </>
      )}
    </div>
  );
};
