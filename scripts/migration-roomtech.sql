-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('PORTATIL', 'PERIFERICO', 'CABLE', 'DISCO', 'HERRAMIENTA', 'RED', 'SERVIDOR', 'RACK', 'AUDIO_VIDEO', 'IMPRESORA', 'OTRO');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('AVAILABLE', 'LOANED', 'IN_REPAIR', 'RETIRED', 'LOST');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'RETURNED', 'OVERDUE', 'LOST', 'DAMAGED');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(140) NOT NULL,
    "code" VARCHAR(40),
    "category" "ItemCategory" NOT NULL DEFAULT 'OTRO',
    "brand" VARCHAR(80),
    "model" VARCHAR(120),
    "serial" VARCHAR(120),
    "location" VARCHAR(160),
    "notes" TEXT,
    "status" "ItemStatus" NOT NULL DEFAULT 'AVAILABLE',
    "loanable" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "borrowerUserId" TEXT,
    "borrowerName" VARCHAR(160),
    "lenderUserId" TEXT NOT NULL,
    "lentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "notes" TEXT,
    "returnNotes" TEXT,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentIncident" (
    "id" TEXT NOT NULL,
    "itemId" TEXT,
    "itemDescription" VARCHAR(200),
    "title" VARCHAR(180) NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "reportedById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EquipmentIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentIncidentComment" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EquipmentIncidentComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentIncidentAttachment" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "mimeType" VARCHAR(120) NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentIncidentAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Item_code_key" ON "Item"("code");

-- CreateIndex
CREATE INDEX "Item_status_idx" ON "Item"("status");

-- CreateIndex
CREATE INDEX "Item_category_idx" ON "Item"("category");

-- CreateIndex
CREATE INDEX "Item_loanable_idx" ON "Item"("loanable");

-- CreateIndex
CREATE INDEX "Item_deletedAt_idx" ON "Item"("deletedAt");

-- CreateIndex
CREATE INDEX "Loan_itemId_idx" ON "Loan"("itemId");

-- CreateIndex
CREATE INDEX "Loan_status_idx" ON "Loan"("status");

-- CreateIndex
CREATE INDEX "Loan_borrowerUserId_idx" ON "Loan"("borrowerUserId");

-- CreateIndex
CREATE INDEX "Loan_lenderUserId_idx" ON "Loan"("lenderUserId");

-- CreateIndex
CREATE INDEX "Loan_dueAt_idx" ON "Loan"("dueAt");

-- CreateIndex
CREATE INDEX "EquipmentIncident_itemId_idx" ON "EquipmentIncident"("itemId");

-- CreateIndex
CREATE INDEX "EquipmentIncident_status_idx" ON "EquipmentIncident"("status");

-- CreateIndex
CREATE INDEX "EquipmentIncident_severity_idx" ON "EquipmentIncident"("severity");

-- CreateIndex
CREATE INDEX "EquipmentIncident_assignedToId_idx" ON "EquipmentIncident"("assignedToId");

-- CreateIndex
CREATE INDEX "EquipmentIncident_reportedById_idx" ON "EquipmentIncident"("reportedById");

-- CreateIndex
CREATE INDEX "EquipmentIncident_deletedAt_idx" ON "EquipmentIncident"("deletedAt");

-- CreateIndex
CREATE INDEX "EquipmentIncidentComment_incidentId_idx" ON "EquipmentIncidentComment"("incidentId");

-- CreateIndex
CREATE INDEX "EquipmentIncidentComment_authorId_idx" ON "EquipmentIncidentComment"("authorId");

-- CreateIndex
CREATE INDEX "EquipmentIncidentAttachment_incidentId_idx" ON "EquipmentIncidentAttachment"("incidentId");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_borrowerUserId_fkey" FOREIGN KEY ("borrowerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_lenderUserId_fkey" FOREIGN KEY ("lenderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentIncident" ADD CONSTRAINT "EquipmentIncident_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentIncident" ADD CONSTRAINT "EquipmentIncident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentIncident" ADD CONSTRAINT "EquipmentIncident_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentIncidentComment" ADD CONSTRAINT "EquipmentIncidentComment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "EquipmentIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentIncidentComment" ADD CONSTRAINT "EquipmentIncidentComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentIncidentAttachment" ADD CONSTRAINT "EquipmentIncidentAttachment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "EquipmentIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentIncidentAttachment" ADD CONSTRAINT "EquipmentIncidentAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
