import { PreviewScreen } from "@/modules/ux-preview/preview-screen";
import { previewPersonaFromSearch } from "@/lib/ux-preview";

export default function UxPreviewPage({ searchParams }: { searchParams: { path?: string; role?: string } }) {
  return <PreviewScreen path={searchParams.path ?? "/dashboard"} persona={previewPersonaFromSearch(searchParams.role)} />;
}
