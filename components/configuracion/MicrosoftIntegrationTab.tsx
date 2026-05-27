"use client";

import { Cloud, Lock, Mail, CalendarDays, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { useTheme } from "@/components/layout/ThemeProvider";
import { cn } from "@/lib/utils";

// TODO: Implement Microsoft Entra ID integration
// Required: AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, AZURE_AD_TENANT_ID
// Reference: https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app
// NextAuth provider: import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"

function DisabledRow({
  icon: Icon,
  label,
  description,
  light,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  light: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 p-3 sm:p-4 rounded-xl border",
        light
          ? "bg-zinc-50 border-zinc-200"
          : "bg-white/[0.025] border-white/8"
      )}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <span
          className={cn(
            "flex w-8 h-8 shrink-0 items-center justify-center rounded-lg",
            light ? "bg-zinc-200/70 text-zinc-500" : "bg-white/8 text-white/45"
          )}
        >
          <Icon className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <p
            className={cn(
              "text-sm font-medium",
              light ? "text-zinc-700" : "text-white/55"
            )}
          >
            {label}
          </p>
          <p
            className={cn(
              "text-xs mt-0.5 leading-relaxed",
              light ? "text-zinc-500" : "text-white/35"
            )}
          >
            {description}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={cn(
            "hidden sm:inline-flex text-[10px] px-2 py-0.5 rounded-full border font-medium",
            light
              ? "bg-amber-50 text-amber-800 border-amber-200"
              : "bg-amber-500/10 text-amber-200 border-amber-500/22"
          )}
        >
          Próximamente
        </span>
        <Switch
          checked={false}
          onCheckedChange={() => undefined}
          disabled
          size="sm"
          light={light}
          label={label}
        />
      </div>
    </div>
  );
}

export function MicrosoftIntegrationTab() {
  const { theme } = useTheme();
  const L = theme === "light";

  return (
    <div className="config-microsoft-root space-y-5 max-w-3xl">
      {/* Hero */}
      <section
        className={cn(
          "relative overflow-hidden rounded-2xl border px-5 py-5 sm:px-6 sm:py-6",
          L
            ? "border-sky-200 bg-gradient-to-br from-white via-sky-50/70 to-sky-100/40 shadow-[var(--lt-shadow-glass)]"
            : "border-[#4a9eff]/22 bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-[#4a9eff]/[0.08]"
        )}
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-16 -right-20 h-52 w-52 rounded-full blur-3xl",
            L ? "bg-sky-200/65" : "bg-[#4a9eff]/15"
          )}
        />
        <div className="relative flex items-start gap-3 sm:gap-4">
          <div
            className={cn(
              "shrink-0 flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-2xl",
              L
                ? "bg-sky-100 text-sky-700 border border-sky-200"
                : "bg-[#4a9eff]/15 text-[#4a9eff] border border-[#4a9eff]/30"
            )}
          >
            <Cloud className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "mb-1 text-[10.5px] font-semibold uppercase tracking-[0.18em]",
                L ? "text-sky-700" : "text-[#4a9eff]/80"
              )}
            >
              Integración
            </p>
            <h2
              className={cn(
                "text-lg sm:text-xl font-semibold leading-tight tracking-tight",
                L ? "text-zinc-900" : "text-white"
              )}
            >
              Microsoft 365
            </h2>
            <p
              className={cn(
                "mt-1.5 text-xs sm:text-sm leading-relaxed",
                L ? "text-zinc-600" : "text-white/55"
              )}
            >
              Conecta la app con Azure Active Directory para habilitar inicio de sesión con
              Microsoft y la sincronización con Teams y Outlook.
            </p>
          </div>
        </div>
      </section>

      {/* Credenciales */}
      <Card className="space-y-4" light={L}>
        <div className="flex items-center gap-2">
          <Lock className={cn("w-4 h-4", L ? "text-zinc-500" : "text-white/40")} />
          <h3
            className={cn(
              "text-sm font-semibold",
              L ? "text-zinc-900" : "text-white"
            )}
          >
            Credenciales Azure AD
          </h3>
        </div>
        <div className="grid gap-3">
          {[
            { label: "Tenant ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
            { label: "Client ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
            { label: "Client Secret", placeholder: "••••••••••••••••••••••••••••••••" },
          ].map((field) => (
            <div key={field.label} className="flex flex-col gap-1.5">
              <label
                className={cn(
                  "text-[10.5px] font-semibold uppercase tracking-wider",
                  L ? "text-zinc-600" : "text-white/45"
                )}
              >
                {field.label}
              </label>
              <input
                type={field.label === "Client Secret" ? "password" : "text"}
                placeholder={field.placeholder}
                disabled
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-sm cursor-not-allowed font-mono",
                  L
                    ? "bg-zinc-100 border border-zinc-200 text-zinc-500 placeholder:text-zinc-400"
                    : "bg-white/[0.03] border border-white/8 text-white/30 placeholder:text-white/15"
                )}
              />
            </div>
          ))}
        </div>
        <p
          className={cn(
            "text-xs leading-relaxed",
            L ? "text-zinc-600" : "text-white/35"
          )}
        >
          En el servidor, define{" "}
          <code className={cn(
            "px-1.5 py-0.5 rounded text-[11px] font-mono",
            L ? "bg-zinc-100 text-zinc-700 border border-zinc-200" : "bg-white/[0.06] text-white/65"
          )}>AZURE_AD_TENANT_ID</code>,{" "}
          <code className={cn(
            "px-1.5 py-0.5 rounded text-[11px] font-mono",
            L ? "bg-zinc-100 text-zinc-700 border border-zinc-200" : "bg-white/[0.06] text-white/65"
          )}>AZURE_AD_CLIENT_ID</code> y{" "}
          <code className={cn(
            "px-1.5 py-0.5 rounded text-[11px] font-mono",
            L ? "bg-zinc-100 text-zinc-700 border border-zinc-200" : "bg-white/[0.06] text-white/65"
          )}>AZURE_AD_CLIENT_SECRET</code>. Con los tres valores, el proveedor Microsoft Entra ID se
          activa y aparece el botón en la pantalla de login. Solo pueden entrar usuarios que ya
          existan en la base de datos (mismo email).
        </p>
      </Card>

      {/* Funcionalidades futuras */}
      <Card className="space-y-3" light={L}>
        <h3
          className={cn(
            "text-sm font-semibold",
            L ? "text-zinc-900" : "text-white"
          )}
        >
          Funcionalidades disponibles (próximamente)
        </h3>
        <div className="space-y-2">
          <DisabledRow
            icon={Lock}
            label="Login con Microsoft"
            description="Permite iniciar sesión con cuentas de Microsoft corporativas"
            light={L}
          />
          <DisabledRow
            icon={MessageSquare}
            label="Sincronizar con Microsoft Teams"
            description="Notificaciones y actualizaciones en canales de Teams"
            light={L}
          />
          <DisabledRow
            icon={CalendarDays}
            label="Sincronizar calendario con Outlook"
            description="Fechas límite de proyectos y tareas en Outlook Calendar"
            light={L}
          />
          <DisabledRow
            icon={Mail}
            label="Recibir avisos por email (Outlook)"
            description="Resumen diario y notificaciones críticas vía correo"
            light={L}
          />
        </div>
      </Card>
    </div>
  );
}
