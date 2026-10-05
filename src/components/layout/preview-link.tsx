"use client";

import Link, { type LinkProps } from "next/link";
import { useSearchParams } from "next/navigation";
import type { AnchorHTMLAttributes } from "react";

import { buildPreviewHref, previewPersonaFromSearch } from "@/lib/ux-preview";

type PreviewLinkProps = LinkProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps>;

/** Preview-only internal link. The URL is the single source of truth for persona state. */
export function PreviewLink({ href, ...props }: PreviewLinkProps) {
  const searchParams = useSearchParams();
  const persona = previewPersonaFromSearch(searchParams.get("previewRole"));
  const previewAccount = searchParams.get("previewAccount");
  const value = typeof href === "string" && href.startsWith("/")
    ? buildPreviewHref(href, persona, previewAccount)
    : href;
  return <Link href={value} {...props} />;
}
