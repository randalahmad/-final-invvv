-- Additive contact metadata for institutional cooperation records.
-- Contacts remain distinct from platform users and scoped contributors.
CREATE TABLE "cooperation_contacts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agreementId" TEXT,
    "name" TEXT NOT NULL,
    "jobTitle" TEXT,
    "departmentName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "cooperationRole" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cooperation_contacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cooperation_contacts_organizationId_status_idx" ON "cooperation_contacts"("organizationId", "status");
CREATE INDEX "cooperation_contacts_agreementId_idx" ON "cooperation_contacts"("agreementId");
CREATE INDEX "cooperation_contacts_email_idx" ON "cooperation_contacts"("email");

ALTER TABLE "cooperation_contacts" ADD CONSTRAINT "cooperation_contacts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cooperation_contacts" ADD CONSTRAINT "cooperation_contacts_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "cooperation_agreements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
