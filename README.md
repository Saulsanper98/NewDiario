# CCMGC OPS — Gran Canaria

Plataforma de gestión operativa (**CCMGC OPS**) para el equipo técnico de CC Gran Canaria.
Incluye Diario de Bitácora y Gestor de Proyectos/Kanban.

---

## Stack

- **Next.js 16** + App Router + TypeScript
- **PostgreSQL** + **Prisma 7**
- **NextAuth v5** (credenciales + preparado para Microsoft Entra ID)
- **Tailwind CSS v4** + Glassmorphism
- **@hello-pangea/dnd** para Kanban drag & drop
- **Tiptap 3** para editor de texto enriquecido
- **Docker Compose** *(opcional)* para levantar PostgreSQL + app en contenedores

---

## Requisitos previos

- Node.js 20+
- **PostgreSQL** (instalación nativa en Windows o Linux; el puerto por defecto es **5432**)
- npm
- *(Opcional)* Docker / Docker Compose solo si quieres levantar Postgres con el `docker-compose.yml` del repo (entonces el host suele usar el puerto **5433** para no chocar con un 5432 local)

---

## Inicio rápido sin Docker (PostgreSQL nativo)

1. Crea en PostgreSQL el rol, la base y el usuario que uses en `DATABASE_URL` (el `.env.example` parte de `ccops` / `ccops_password` / `ccops_db` en `127.0.0.1:5432`).
2. Copia `.env.example` a `.env` y revisa `DATABASE_URL`, `AUTH_SECRET` y `NEXTAUTH_URL`.
3. En la carpeta del proyecto:

```bash
npm install
npm run setup
npm run dev
```

Accede en la URL que indique la consola (por ejemplo [http://localhost:3000](http://localhost:3000)).

---

## Inicio rápido con Docker Compose *(opcional)*

```bash
# 1. Clona / copia el proyecto y entra al directorio
cd cc-ops

# 2. Copia el archivo de variables de entorno
cp .env.example .env
# Edita .env: define AUTH_SECRET (o NEXTAUTH_SECRET) con un valor aleatorio largo; sin esto Auth.js falla en el middleware
# Si usas Compose, usa DATABASE_URL con puerto 5433 (ver comentarios en .env.example).

# 3. Levanta la base de datos PostgreSQL (expuesta en el host como puerto 5433)
docker compose up postgres -d

# 4. Instala dependencias
npm install

# 5. Genera el cliente Prisma, aplica el schema y ejecuta el seed
npm run setup

# 6. Arranca el servidor de desarrollo
npm run dev
```

Accede en: [http://localhost:3000](http://localhost:3000)

---

## Levantar el stack completo con Docker

```bash
# Construye y levanta todo (PostgreSQL + App)
docker compose up --build

# Con seed inicial
docker compose exec app npm run db:seed
```

---

## Credenciales de ejemplo (seed)

| Rol            | Email                              | Contraseña     |
|----------------|------------------------------------|----------------|
| **SuperAdmin** | superadmin@ccgrancanaria.es        | superadmin2024 |
| Admin Sistemas | admin.sistemas@ccgrancanaria.es    | admin2024      |
| Admin Redes    | admin.redes@ccgrancanaria.es       | admin2024      |
| Operador       | juan.garcia@ccgrancanaria.es       | ccops2024      |
| Operador       | pedro.lopez@ccgrancanaria.es       | ccops2024      |
| Multidept.     | sofia.ruiz@ccgrancanaria.es        | ccops2024      |

---

## Scripts disponibles

```bash
npm run dev          # Servidor de desarrollo
npm run test         # Vitest (smoke en lib/)
npm run build        # Build de producción
npm run db:generate  # Genera el cliente Prisma
npm run db:push      # Aplica el schema a la BD (sin migraciones)
npm run db:migrate   # Crea y aplica migraciones
npm run db:seed      # Carga datos de ejemplo
npm run db:studio    # Abre Prisma Studio
npm run db:reset     # Reset + seed (¡borra todos los datos!)
npm run setup        # Genera, aplica schema y seed (primera vez)
```

---

## Funcionalidades principales

### Diario de Bitácora
- Feed cronológico por departamento + contenido compartido
- Filtros por turno, tipo, autor, etiquetas y seguimiento
- Editor de texto enriquecido (Tiptap): negrita, cursiva, listas, tablas
- Sistema de seguimiento con badge visual y marcado "atendido"
- Compartir entradas con otros departamentos (lectura / lectura + comentarios)
- Comentarios por entrada con hilo de conversación
- Historial de ediciones

### Vista Traspaso de Turno
- Entradas de las últimas 24h por turno
- Tareas de turno activas
- Incidencias sin resolver (48h)
- Contador de entradas por turno del día

### Gestor de Proyectos
- Lista de proyectos con barra de progreso
- **Kanban con drag & drop real** (columnas personalizables)
- Vista de lista de tareas con ordenación
- Timeline / Gantt simplificado (solo lectura)
- Feed de actividad del proyecto
- Panel lateral deslizable de detalle de tarea
- Subtareas con checkbox, comentarios, etiquetas

### Dashboard
- Saludo personalizado con turno actual
- Resumen de entradas recientes, mis tareas y tareas de turno
- Proyectos activos con progreso
- Tareas vencidas del equipo

### Configuración (Admin / SuperAdmin)
- Gestión de usuarios y departamentos
- Configuración de turnos y columnas Kanban por defecto
- Logs de auditoría
- Sección Microsoft 365 preparada para futura integración

---

## Seguridad y permisos

- Todo el contenido es **privado al departamento** por defecto
- El contenido se comparte explícitamente con permisos de lectura o lectura+comentarios
- Middleware Next.js protege todas las rutas privadas
- API routes verifican sesión y permisos por departamento en cada petición
- Roles: SuperAdmin > Admin > Operator

---

## Roadmap / Integraciones futuras

- [ ] **Microsoft Entra ID (Azure AD)** — Login SSO corporativo
- [ ] **Microsoft Teams** — Notificaciones en canales
- [ ] **Outlook Calendar** — Sincronización de fechas límite
- [ ] Exportación PDF de bitácora con logo corporativo
- [ ] Adjuntos reales (upload a disco/S3)
- [ ] Buscador global `Cmd+K` con resultados en tiempo real
- [ ] Notificaciones push/email
- [ ] App móvil (PWA)

### Activar login con Microsoft (cuando disponible)

1. Registra una app en [Azure Portal](https://portal.azure.com)
2. Copia Tenant ID, Client ID y Client Secret al `.env`
3. Descomenta el provider `MicrosoftEntraID` en `lib/auth/config.ts`
4. Activa el toggle en Configuración → Microsoft 365

---

## Estructura del proyecto

```
app/
  (auth)/login          # Página de login
  (dashboard)/          # Layout con sidebar
    dashboard/          # Pantalla de inicio
    bitacora/           # Feed + detalle + nueva entrada
    proyectos/          # Lista + vista de proyecto (Kanban)
    traspaso/           # Vista de traspaso de turno
    configuracion/      # Panel de administración
  api/                  # API Routes
  generated/prisma/     # Cliente Prisma generado

components/
  ui/                   # Button, Card, Badge, Avatar, Input, Modal...
  layout/               # Sidebar, Header, SessionProvider
  bitacora/             # Feed, Detail, NewForm, Editor, Traspaso
  kanban/               # Board, Card, TaskDetailPanel, ListView
  proyectos/            # ProjectList, ProjectView, Timeline, Activity
  dashboard/            # DashboardContent
  configuracion/        # Tabs, Users, Departments, Settings...

lib/
  auth/                 # NextAuth config, types, permissions
  prisma/               # PrismaClient singleton
  utils.ts              # Helpers, labels, color maps

prisma/
  schema.prisma         # Schema completo
  seed.ts               # Datos de ejemplo
```
