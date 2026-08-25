import React, { useRef, useState } from "react";
import { IconPlus as Plus } from "@tabler/icons-react";
import { EmpleadosTab, type EmpleadosTabHandle } from "../../components/personal/EmpleadosTab";
import { CatalogoCrud, type CatalogoCrudHandle } from "../../components/personal/CatalogoCrud";
import { cargosService, areasService } from "../../services/catalogosService";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/cn";

type Tab = "empleados" | "cargos" | "areas";

const tabs: { id: Tab; label: string }[] = [
  { id: "empleados", label: "Empleados" },
  { id: "cargos", label: "Cargos" },
  { id: "areas", label: "Áreas" },
];

const nuevoLabel: Record<Tab, string> = {
  empleados: "Nuevo empleado",
  cargos: "Nuevo cargo",
  areas: "Nueva área",
};

export const PersonalPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>("empleados");
  const empleadosRef = useRef<EmpleadosTabHandle>(null);
  const cargosRef = useRef<CatalogoCrudHandle>(null);
  const areasRef = useRef<CatalogoCrudHandle>(null);

  const handleNuevo = () => {
    if (tab === "empleados") empleadosRef.current?.abrirNuevo();
    else if (tab === "cargos") cargosRef.current?.abrirNuevo();
    else areasRef.current?.abrirNuevo();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Personal</h1>
        </div>
        <Button onClick={handleNuevo}>
          <Plus className="h-4 w-4" />
          {nuevoLabel[tab]}
        </Button>
      </div>

      <div className="border-b">
        <nav className="-mb-px flex gap-8">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "cursor-pointer whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors",
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === "empleados" && <EmpleadosTab ref={empleadosRef} />}
      {tab === "cargos" && <CatalogoCrud ref={cargosRef} singular="cargo" service={cargosService} />}
      {tab === "areas" && <CatalogoCrud ref={areasRef} singular="área" service={areasService} />}
    </div>
  );
};
