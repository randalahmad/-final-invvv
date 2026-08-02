-- AlterTable
ALTER TABLE "users" ADD COLUMN     "registrationNote" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "requestedDepartmentId" TEXT,
ADD COLUMN     "requestedOrgType" "OrganizationType",
ADD COLUMN     "requestedOrganizationName" TEXT;
