"use client";

import { Cloud, Lock } from "lucide-react";
import { Card } from "@/components/ui/Card";

// TODO: Implement Microsoft Entra ID integration
// Required: AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, AZURE_AD_TENANT_ID
// Reference: https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app
// NextAuth provider: import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"

function DisabledToggle({ label, description }: { label: string; description: string }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white/2 border border-white/6">
      <div>
        <p className="text-sm font-medium text-white/50">{label}</p>
        <p className="text-xs text-white/25 mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-white/25 bg-white/5 px-2 py-0.5 rounded-full border border-white/8">
          Próximamente
        </span>
        <div className="w-9 h-5 rounded-full bg-white/10 border border-white/15 relative cursor-not-allowed">
          <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white/25" />
        </div>
      </div>
    </div>
  );
}

export function MicrosoftIntegrationTab() {
  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3 p-4 rounded-xl bg-[#4a9eff]/8 border border-[#4a9eff]/20">
        <Cloud className="w-5 h-5 text-[#4a9eff] shrink-0" />
        <div>
          <p className="text-sm font-semibold text-white">
            Integración con Microsoft 365
          </p>
          <p className="text-xs text-white/50 mt-0.5">
            Configura la conexión con Azure Active Directory para habilitar el
            inicio de sesión con Microsoft y la sincronización con Teams y Outlook.
          </p>
        </div>
      </div>

      <Card className="space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Lock className="w-4 h-4 text-white/40" />
          Credenciales Azure AD
        </h3>
        {[
          { label: "Tenant ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
          { label: "Client ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
          { label: "Client Secret", placeholder: "••••••••••••••••••••••••••••••••" },
        ].map((field) => (
          <div key={field.label} className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-white/40 uppercase tracking-wide">
              {field.label}
            </label>
            <input
              type={field.label === "Client Secret" ? "password" : "text"}
              placeholder={field.placeholder}
              disabled
              className="w-full bg-white/3 border border-white/8 rounded-lg px-3 py-2 text-sm text-white/30 placeholder:text-white/15 cursor-not-allowed"
            />
          </div>
        ))}
        <p className="text-xs text-white/25">
          En el servidor, define{" "}
          <code className="text-white/40">AZURE_AD_TENANT_ID</code>,{" "}
          <code className="text-white/40">AZURE_AD_CLIENT_ID</code> y{" "}
          <code className="text-white/40">AZURE_AD_CLIENT_SECRET</code>. Con los
          tres valores, el proveedor Microsoft Entra ID se activa y aparece el
          botón de inicio de sesión en la pantalla de login. Solo pueden entrar
          usuarios que ya existan en la base de datos (mismo email).
        </p>
      </Card>

      <Card className="space-y-3">
        <h3 className="text-sm font-semibold text-white mb-4">
          Funcionalidades disponibles (próximamente)
        </h3>
        <DisabledToggle
          label="Login con Microsoft"
          description="Permite iniciar sesión con cuentas de Microsoft corporativas"
        />
        <DisabledToggle
          label="Sincronizar con Microsoft Teams"
          description="Notificaciones y actualizaciones en canales de Teams"
        />
        <DisabledToggle
          label="Sincronizar calendario con Outlook"
          description="Fechas límite de proyectos y tareas en Outlook Calendar"
        />
      </Card>
    </div>
  );
}
