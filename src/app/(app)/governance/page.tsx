import { DgaUnitPage } from "@/modules/dga/components/unit-page";
import { DGA_UNITS } from "@/modules/dga/source-of-truth";
export default function GovernancePage() { return <DgaUnitPage unit={DGA_UNITS[2]} />; }
