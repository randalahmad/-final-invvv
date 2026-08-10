import { notFound } from "next/navigation";
import { DgaUnitPage } from "@/modules/dga/components/unit-page";
import { DGA_UNITS, getDgaRequirement } from "@/modules/dga/source-of-truth";
export default function MethodologyRequirementPage({ params }: { params: { requirementId: string } }) { const unit = DGA_UNITS[1]; const requirement = getDgaRequirement(unit, params.requirementId); if (!requirement) notFound(); return <DgaUnitPage unit={unit} requirement={requirement} />; }
