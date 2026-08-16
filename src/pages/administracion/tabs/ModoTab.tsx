import React, { useEffect, useState } from "react";
import { configService } from "../../../services/configService";
import { Button } from "../../../components/ui/button";
import { Field, FieldLabel, FieldDescription } from "../../../components/ui/field";
import { Input } from "../../../components/ui/input";
import { PageSpinner } from "../../../components/ui/spinner";
import { notificarExito, notificarError } from "../../../lib/alertas";
import { IconRobot as Bot, IconUser as User } from "@tabler/icons-react";
import { cn } from "../../../lib/cn";

const MAX_DEFAULT = 5;

export const ModoTab: React.FC = () => {
  const [mode, setMode] = useState<"ia" | "manual">("manual");
  const [maxTicketsAbiertos, setMaxTicketsAbiertos] = useState(MAX_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    configService.getAppConfig()
      .then((config) => {
        setMode(config.assignmentMode);
        setMaxTicketsAbiertos(config.maxTicketsAbiertos ?? MAX_DEFAULT);
      })
      .catch(() => notificarError("Error al cargar la configuración"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (maxTicketsAbiertos < 1) {
      notificarError("El máximo de tickets abiertos debe ser al menos 1");
      return;
    }
    setSaving(true);
    try {
      await configService.updateAssignmentMode(mode);
      await configService.updateMaxTicketsAbiertos(maxTicketsAbiertos);
      notificarExito("Modo de asignación actualizado");
    } catch {
      notificarError("Error al actualizar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2 text-center">
        <h3 className="text-lg font-medium">Selecciona el modo de asignación de tickets</h3>
      </div>

      <div className="mx-auto grid max-w-xl grid-cols-1 justify-center gap-4 sm:grid-cols-2">
        <button
          onClick={() => setMode("manual")}
          className={cn(
            "flex cursor-pointer flex-col items-center space-y-3 rounded-xl border-2 p-6 text-center transition-all",
            mode === "manual" ? "border-primary bg-primary/5" : "hover:border-primary/40"
          )}
        >
          <div
            className={cn(
              "rounded-full p-3",
              mode === "manual" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            <User className="h-8 w-8" />
          </div>
          <span className="font-bold">Asignación Manual</span>
        </button>

        <div className="relative">
          <button
            onClick={() => setMode("ia")}
            className={cn(
              "flex w-full cursor-pointer flex-col items-center space-y-3 rounded-xl border-2 p-6 text-center transition-all",
              mode === "ia" ? "border-primary bg-primary/5" : "hover:border-primary/40"
            )}
          >
            <div
              className={cn(
                "rounded-full p-3",
                mode === "ia" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}
            >
              <Bot className="h-8 w-8" />
            </div>
            <span className="font-bold">Asignación por IA</span>
          </button>
        </div>
      </div>

      <Field className="mx-auto max-w-xs">
        <FieldLabel htmlFor="maxTicketsAbiertos">Máximo de tickets abiertos por empleado</FieldLabel>
        <Input
          id="maxTicketsAbiertos"
          type="number"
          min={1}
          value={maxTicketsAbiertos}
          onChange={(e) => setMaxTicketsAbiertos(Number(e.target.value))}
        />
        <FieldDescription>
          Al llegar a este número de tickets abiertos, el empleado se marca "Ocupado" y la IA prioriza
          asignar a otro. Si toda el área está ocupada, igual asigna al de menor carga.
        </FieldDescription>
      </Field>

      <div className="flex justify-end border-t pt-6">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar Cambios"}
        </Button>
      </div>
    </div>
  );
};
