import { PrismaClient, type LogEntry } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Priority, ProjectStatus } from "../app/generated/prisma/enums";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding CCMGC OPS database...");

  // ─── Departments ────────────────────────────────────────────────────────────
  const depts = await Promise.all([
    prisma.department.upsert({
      where: { slug: "sistemas" },
      update: {},
      create: {
        name: "Sistemas",
        slug: "sistemas",
        accentColor: "#FFEB66",
      },
    }),
    prisma.department.upsert({
      where: { slug: "redes" },
      update: {},
      create: {
        name: "Redes",
        slug: "redes",
        accentColor: "#4A9EFF",
      },
    }),
    prisma.department.upsert({
      where: { slug: "tecnicos-sala" },
      update: {},
      create: {
        name: "Técnicos de Sala",
        slug: "tecnicos-sala",
        accentColor: "#A78BFA",
      },
    }),
    prisma.department.upsert({
      where: { slug: "operadores" },
      update: {},
      create: {
        name: "Operadores",
        slug: "operadores",
        accentColor: "#34D399",
      },
    }),
  ]);

  const [sistemas, redes, tecnicosSala, operadores] = depts;
  console.log("✅ Departamentos creados");

  // ─── Users ─────────────────────────────────────────────────────────────────
  const hashedPass = await bcrypt.hash("ccops2024", 10);
  const hashedAdmin = await bcrypt.hash("admin2024", 10);

  const users = await Promise.all([
    // SuperAdmin
    prisma.user.upsert({
      where: { email: "superadmin@ccgrancanaria.es" },
      update: {},
      create: {
        name: "Super Admin",
        email: "superadmin@ccgrancanaria.es",
        password: await bcrypt.hash("superadmin2024", 10),
        role: "SUPERADMIN",
        departments: {
          create: [
            { departmentId: sistemas.id, role: "SUPERADMIN", isDefault: true },
          ],
        },
      },
    }),
    // Admin Sistemas
    prisma.user.upsert({
      where: { email: "admin.sistemas@ccgrancanaria.es" },
      update: {},
      create: {
        name: "Carlos Rodríguez",
        email: "admin.sistemas@ccgrancanaria.es",
        password: hashedAdmin,
        role: "ADMIN",
        departments: {
          create: [
            { departmentId: sistemas.id, role: "ADMIN", isDefault: true },
          ],
        },
      },
    }),
    // Admin Redes
    prisma.user.upsert({
      where: { email: "admin.redes@ccgrancanaria.es" },
      update: {},
      create: {
        name: "María González",
        email: "admin.redes@ccgrancanaria.es",
        password: hashedAdmin,
        role: "ADMIN",
        departments: {
          create: [
            { departmentId: redes.id, role: "ADMIN", isDefault: true },
          ],
        },
      },
    }),
    // Operadores Sistemas
    prisma.user.upsert({
      where: { email: "juan.garcia@ccgrancanaria.es" },
      update: {},
      create: {
        name: "Juan García",
        email: "juan.garcia@ccgrancanaria.es",
        password: hashedPass,
        role: "OPERATOR",
        departments: {
          create: [
            { departmentId: sistemas.id, role: "OPERATOR", isDefault: true },
          ],
        },
      },
    }),
    prisma.user.upsert({
      where: { email: "ana.martinez@ccgrancanaria.es" },
      update: {},
      create: {
        name: "Ana Martínez",
        email: "ana.martinez@ccgrancanaria.es",
        password: hashedPass,
        role: "OPERATOR",
        departments: {
          create: [
            { departmentId: sistemas.id, role: "OPERATOR", isDefault: true },
          ],
        },
      },
    }),
    // Operadores Redes
    prisma.user.upsert({
      where: { email: "pedro.lopez@ccgrancanaria.es" },
      update: {},
      create: {
        name: "Pedro López",
        email: "pedro.lopez@ccgrancanaria.es",
        password: hashedPass,
        role: "OPERATOR",
        departments: {
          create: [
            { departmentId: redes.id, role: "OPERATOR", isDefault: true },
          ],
        },
      },
    }),
    prisma.user.upsert({
      where: { email: "lucia.fernandez@ccgrancanaria.es" },
      update: {},
      create: {
        name: "Lucía Fernández",
        email: "lucia.fernandez@ccgrancanaria.es",
        password: hashedPass,
        role: "OPERATOR",
        departments: {
          create: [
            { departmentId: redes.id, role: "OPERATOR", isDefault: true },
          ],
        },
      },
    }),
    // Técnicos de Sala
    prisma.user.upsert({
      where: { email: "miguel.santos@ccgrancanaria.es" },
      update: {},
      create: {
        name: "Miguel Santos",
        email: "miguel.santos@ccgrancanaria.es",
        password: hashedPass,
        role: "OPERATOR",
        departments: {
          create: [
            { departmentId: tecnicosSala.id, role: "OPERATOR", isDefault: true },
          ],
        },
      },
    }),
    // Multidisciplinar
    prisma.user.upsert({
      where: { email: "sofia.ruiz@ccgrancanaria.es" },
      update: {},
      create: {
        name: "Sofía Ruiz",
        email: "sofia.ruiz@ccgrancanaria.es",
        password: hashedPass,
        role: "OPERATOR",
        departments: {
          create: [
            { departmentId: sistemas.id, role: "OPERATOR", isDefault: true },
            { departmentId: redes.id, role: "OPERATOR" },
          ],
        },
      },
    }),
    // Operadores dept
    prisma.user.upsert({
      where: { email: "roberto.diaz@ccgrancanaria.es" },
      update: {},
      create: {
        name: "Roberto Díaz",
        email: "roberto.diaz@ccgrancanaria.es",
        password: hashedPass,
        role: "OPERATOR",
        departments: {
          create: [
            { departmentId: operadores.id, role: "OPERATOR", isDefault: true },
          ],
        },
      },
    }),
  ]);

  const adminSistemas = users[1]!;
  const adminRedes = users[2]!;
  const juan = users[3]!;
  const ana = users[4]!;
  const pedro = users[5]!;
  const lucia = users[6]!;
  const miguel = users[7]!;
  const sofia = users[8]!;
  console.log("✅ Usuarios creados");

  // ─── Log Entries ───────────────────────────────────────────────────────────
  const logEntries = [
    {
      title: "Caída del servidor de correo durante 45 minutos",
      content: "<p>Se detectó una caída completa del servidor Exchange a las 08:30h. El equipo de sistemas intervino de inmediato restableciendo el servicio a las 09:15h. Causa: disco de logs al 100% de capacidad.</p><p><strong>Acciones tomadas:</strong></p><ul><li>Limpieza de logs antiguos</li><li>Aumento de espacio en disco</li><li>Monitoreo intensificado durante 24h</li></ul>",
      type: "INCIDENCIA" as const,
      shift: "MORNING" as const,
      requiresFollowup: true,
      authorId: adminSistemas.id,
      departmentId: sistemas.id,
    },
    {
      title: "Actualización de firmware switches core - Sin novedad",
      content: "<p>Se realizó la actualización planificada del firmware de los switches core en la sala de servidores. Todo el proceso transcurrió sin incidencias. Tiempo total: 2 horas.</p>",
      type: "MANTENIMIENTO" as const,
      shift: "NIGHT" as const,
      requiresFollowup: false,
      authorId: pedro.id,
      departmentId: redes.id,
    },
    {
      title: "Sin novedades - Turno de mañana",
      content: "<p>Turno de mañana sin incidencias reseñables. Todos los sistemas operativos al 100%.</p>",
      type: "SIN_NOVEDADES" as const,
      shift: "MORNING" as const,
      requiresFollowup: false,
      authorId: juan.id,
      departmentId: sistemas.id,
    },
    {
      title: "URGENTE: Interrupción de conectividad en planta 3",
      content: "<p>🚨 Se detecta pérdida total de conectividad en la planta 3 a las 15:20h. Afecta a aproximadamente 30 puestos de trabajo. El equipo de redes está investigando la causa.</p>",
      type: "URGENTE" as const,
      shift: "AFTERNOON" as const,
      requiresFollowup: true,
      authorId: lucia.id,
      departmentId: redes.id,
    },
    {
      title: "Nuevo equipo de grabación instalado en sala A",
      content: "<p>Se ha instalado y configurado el nuevo sistema de grabación en sala A. El equipo queda operativo para el turno de tarde. Se ha actualizado el inventario correspondiente.</p>",
      type: "INFORMATIVO" as const,
      shift: "MORNING" as const,
      requiresFollowup: false,
      authorId: miguel.id,
      departmentId: tecnicosSala.id,
    },
    {
      title: "Backup diario completado - Resultados OK",
      content: "<p>Backup nocturno completado satisfactoriamente a las 04:15h. Tamaño total: 847 GB. Destino: NAS principal y copia offsite.</p>",
      type: "INFORMATIVO" as const,
      shift: "NIGHT" as const,
      requiresFollowup: false,
      authorId: ana.id,
      departmentId: sistemas.id,
    },
    {
      title: "Problema de autenticación en VPN corporativa",
      content: "<p>Varios usuarios reportan problemas para conectarse a la VPN corporativa desde el exterior. Se está investigando si es un problema del servidor RADIUS o del certificado.</p>",
      type: "INCIDENCIA" as const,
      shift: "AFTERNOON" as const,
      requiresFollowup: true,
      followupDone: false,
      authorId: sofia.id,
      departmentId: sistemas.id,
    },
    {
      title: "Mantenimiento preventivo UPS sala de servidores",
      content: "<p>Se realizó revisión completa de los UPS de la sala de servidores. Baterías en buen estado, autonomía estimada: 45 minutos con carga actual.</p>",
      type: "MANTENIMIENTO" as const,
      shift: "MORNING" as const,
      requiresFollowup: false,
      authorId: adminSistemas.id,
      departmentId: sistemas.id,
    },
  ];

  const createdLogs: LogEntry[] = [];
  for (const log of logEntries) {
    const entry = await prisma.logEntry.create({
      data: {
        ...log,
        status: "PUBLISHED",
        tags: {
          create: [],
        },
      },
    });
    createdLogs.push(entry);
  }
  console.log("✅ Entradas de bitácora creadas");

  // Share some log entries between departments
  await prisma.logShare.create({
    data: {
      logEntryId: createdLogs[3].id, // URGENTE redes
      departmentId: sistemas.id,
      permission: "READ_COMMENT",
    },
  });

  // ─── Projects ──────────────────────────────────────────────────────────────
  const DEFAULT_COLUMNS = [
    { name: "Backlog", order: 0, color: "#6B7280" },
    { name: "Pendiente", order: 1, color: "#F59E0B" },
    { name: "En Progreso", order: 2, color: "#3B82F6" },
    { name: "En Revisión", order: 3, color: "#8B5CF6" },
    { name: "Completado", order: 4, color: "#10B981" },
  ];

  async function createProject(data: {
    name: string;
    description: string;
    departmentId: string;
    ownerId: string;
    status?: ProjectStatus;
    priority?: Priority;
    endDate?: Date;
    memberIds?: string[];
  }) {
    const project = await prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        departmentId: data.departmentId,
        status: data.status ?? "ACTIVE",
        priority: data.priority ?? "MEDIUM",
        endDate: data.endDate,
        kanbanColumns: {
          createMany: { data: DEFAULT_COLUMNS },
        },
      },
    });

    // Add members
    const memberIds = [data.ownerId, ...(data.memberIds ?? [])];
    for (const uid of [...new Set(memberIds)]) {
      await prisma.projectMember.create({
        data: {
          projectId: project.id,
          userId: uid,
          isOwner: uid === data.ownerId,
        },
      });
    }

    // Log activity
    await prisma.projectActivity.create({
      data: {
        projectId: project.id,
        description: `Proyecto "${data.name}" creado`,
      },
    });

    const cols = await prisma.kanbanColumn.findMany({
      where: { projectId: project.id },
      orderBy: { order: "asc" },
    });

    return { project, cols };
  }

  // Project 1: Migración a cloud
  const { project: p1, cols: p1cols } = await createProject({
    name: "Migración Infraestructura a Cloud",
    description: "<p>Migración progresiva de la infraestructura on-premise a un entorno cloud híbrido. Objetivo: reducir costos operativos y mejorar la disponibilidad.</p>",
    departmentId: sistemas.id,
    ownerId: adminSistemas.id,
    priority: "HIGH",
    endDate: new Date("2025-06-30"),
    memberIds: [juan.id, ana.id, sofia.id],
  });

  // Tasks for p1
  const p1Tasks = [
    { title: "Inventario de servidores actuales", columnIdx: 4, assigneeId: juan.id, priority: "HIGH" as const },
    { title: "Análisis de costos y proveedores cloud", columnIdx: 4, assigneeId: adminSistemas.id, priority: "HIGH" as const },
    { title: "POC con AWS - entorno de pruebas", columnIdx: 3, assigneeId: ana.id, priority: "MEDIUM" as const },
    { title: "Migración base de datos MySQL", columnIdx: 2, assigneeId: sofia.id, priority: "HIGH" as const },
    { title: "Configurar VPN site-to-site", columnIdx: 1, assigneeId: juan.id, priority: "MEDIUM" as const },
    { title: "Plan de contingencia y rollback", columnIdx: 0, assigneeId: adminSistemas.id, priority: "HIGH" as const },
  ];

  for (let i = 0; i < p1Tasks.length; i++) {
    const t = p1Tasks[i];
    await prisma.task.create({
      data: {
        title: t.title,
        projectId: p1.id,
        columnId: p1cols[t.columnIdx].id,
        assigneeId: t.assigneeId,
        priority: t.priority,
        order: i,
      },
    });
  }

  // Project 2: Renovación de red
  const { project: p2, cols: p2cols } = await createProject({
    name: "Renovación Red Local - Planta 1 y 2",
    description: "<p>Sustitución de switches de acceso antiguos por equipamiento nuevo con soporte para VLANs y QoS mejorado.</p>",
    departmentId: redes.id,
    ownerId: adminRedes.id,
    priority: "MEDIUM",
    endDate: new Date("2025-04-15"),
    memberIds: [pedro.id, lucia.id],
  });

  const p2Tasks = [
    { title: "Especificaciones técnicas nuevos switches", columnIdx: 4, assigneeId: adminRedes.id, priority: "MEDIUM" as const, isShiftTask: false },
    { title: "Aprobación presupuesto compra", columnIdx: 4, assigneeId: adminRedes.id, priority: "HIGH" as const },
    { title: "Instalación planta 1 - zona A", columnIdx: 2, assigneeId: pedro.id, priority: "MEDIUM" as const, isShiftTask: true },
    { title: "Instalación planta 1 - zona B", columnIdx: 1, assigneeId: lucia.id, priority: "MEDIUM" as const, isShiftTask: true },
    { title: "Instalación planta 2", columnIdx: 0, assigneeId: pedro.id, priority: "LOW" as const },
    { title: "Documentación topología actualizada", columnIdx: 0, assigneeId: lucia.id, priority: "LOW" as const },
  ];

  for (let i = 0; i < p2Tasks.length; i++) {
    const t = p2Tasks[i];
    await prisma.task.create({
      data: {
        title: t.title,
        projectId: p2.id,
        columnId: p2cols[t.columnIdx].id,
        assigneeId: t.assigneeId,
        priority: t.priority,
        order: i,
        isShiftTask: t.isShiftTask ?? false,
      },
    });
  }

  // Project 3: Mejora sala técnica
  const { project: p3, cols: p3cols } = await createProject({
    name: "Mejora Sala Técnica Principal",
    description: "<p>Modernización del equipamiento de la sala técnica principal. Incluye nuevo sistema de control de acceso y mejora del sistema de refrigeración.</p>",
    departmentId: tecnicosSala.id,
    ownerId: miguel.id,
    priority: "LOW",
    memberIds: [],
  });

  await prisma.task.create({
    data: {
      title: "Instalar nuevo sistema control de acceso",
      projectId: p3.id,
      columnId: p3cols[1].id,
      assigneeId: miguel.id,
      priority: "MEDIUM",
      order: 0,
    },
  });

  // Share p1 with Redes
  await prisma.projectShare.create({
    data: {
      projectId: p1.id,
      departmentId: redes.id,
      permission: "READ",
    },
  });

  console.log("✅ Proyectos y tareas creados");

  // ─── Notificaciones de ejemplo ─────────────────────────────────────────────
  const superAdminRow = await prisma.user.findUnique({
    where: { email: "superadmin@ccgrancanaria.es" },
  });
  if (superAdminRow) {
    await prisma.notification.createMany({
      data: [
        {
          userId: superAdminRow.id,
          type: "TASK_ASSIGNED",
          title: "Tarea asignada (demo)",
          message:
            "Así verás avisos en el panel. Marca como leídas o revisa el enlace.",
          link: "/dashboard",
          isRead: false,
        },
        {
          userId: superAdminRow.id,
          type: "LOG_SHARED",
          title: "Entrada compartida (demo)",
          message:
            "Ejemplo de notificación ligada a la bitácora cuando haya integración completa.",
          link: "/bitacora",
          isRead: true,
        },
      ],
    });
  }
  console.log("✅ Notificaciones de ejemplo");

  // ─── App Settings ──────────────────────────────────────────────────────────
  const settings = [
    { key: "app_name", value: "CCMGC OPS" },
    { key: "shift_morning_start", value: "06:00" },
    { key: "shift_morning_end", value: "14:00" },
    { key: "shift_afternoon_start", value: "14:00" },
    { key: "shift_afternoon_end", value: "22:00" },
    { key: "shift_night_start", value: "22:00" },
    { key: "shift_night_end", value: "06:00" },
  ];

  for (const s of settings) {
    await prisma.appSettings.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }

  console.log("✅ Configuración inicial guardada");
  console.log("\n🎉 Seed completado!\n");
  console.log("═══════════════════════════════════════");
  console.log("  CREDENCIALES DE EJEMPLO:");
  console.log("═══════════════════════════════════════");
  console.log("  SuperAdmin:     superadmin@ccgrancanaria.es / superadmin2024");
  console.log("  Admin Sistemas: admin.sistemas@ccgrancanaria.es / admin2024");
  console.log("  Admin Redes:    admin.redes@ccgrancanaria.es / admin2024");
  console.log("  Operador:       juan.garcia@ccgrancanaria.es / ccops2024");
  console.log("  Operador:       pedro.lopez@ccgrancanaria.es / ccops2024");
  console.log("═══════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
