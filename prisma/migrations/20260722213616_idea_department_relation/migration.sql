-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
