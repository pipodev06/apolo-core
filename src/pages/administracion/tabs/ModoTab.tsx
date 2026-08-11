import React, { useEffect, useState } from "react";
import { configService } from "../../../services/configService";
import { Button } from "../../../components/ui/button";
import { PageSpinner } from "../../../components/ui/spinner";
import { notificarExito, notificarError } from "../../../lib/alertas";
import { IconRobot as Bot, IconUser as User } from "@tabler/icons-react";
import { cn } from "../../../lib/cn";

export const ModoTab: React.FC = () => {
  const [mode, setMode] = useState<"ia" | "manual">("manual");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    configService.getAppConfig()
      .then((config) => setMode(config.assignmentMode))
      .catch(() => notificarError("Error al cargar la configuración"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await configService.updateAssignmentMode(mode);
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
        <h3 className="text-lg font-medium text-gray-800">Selecciona el modo de asignación de tickets</h3>
      </div>

      <div className="mx-auto grid max-w-xl grid-cols-1 justify-center gap-4 sm:grid-cols-2">
        <button
          onClick={() => setMode("manual")}
          className={cn(
            "flex cursor-pointer flex-col items-center space-y-3 rounded-xl border-2 p-6 text-center transition-all",
            mode === "manual"
              ? "border-indigo-600 bg-indigo-600/5"
              : "border-gray-200 hover:border-indigo-600/40"
          )}
        >
          <div
            className={cn(
              "rounded-full p-3",
              mode === "manual" ? "bg-indigo-600/10 text-indigo-600" : "bg-gray-100 text-gray-800"
            )}
          >
            <User className="h-8 w-8" />
          </div>
          <span className="font-bold text-gray-800">Asignación Manual</span>
        </button>

        <div className="relative">
          <button
            onClick={() => setMode("ia")}
            className={cn(
              "flex w-full cursor-pointer flex-col items-center space-y-3 rounded-xl border-2 p-6 text-center transition-all",
              mode === "ia"
                ? "border-indigo-600 bg-indigo-600/5"
                : "border-gray-200 hover:border-indigo-600/40"
            )}
          >
            <div
              className={cn(
                "rounded-full p-3",
                mode === "ia" ? "bg-indigo-600/10 text-indigo-600" : "bg-gray-100 text-gray-800"
              )}
            >
              <Bot className="h-8 w-8" />
            </div>
            <span className="font-bold text-gray-800">Asignación por IA</span>
          </button>
        </div>
      </div>

      <div className="flex justify-end border-t border-gray-200 pt-6">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar Cambios"}
        </Button>
      </div>
    </div>
  );
};
