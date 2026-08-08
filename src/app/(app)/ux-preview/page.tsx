import { PreviewScreen } from "@/modules/ux-preview/preview-screen";

export default function UxPreviewPage({ searchParams }: { searchParams: { path?: string } }) {
  return <PreviewScreen path={searchParams.path ?? "/dashboard"} />;
}
