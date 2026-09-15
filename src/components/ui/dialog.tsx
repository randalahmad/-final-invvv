"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
export function DialogContent({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  return <DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-sm" /><DialogPrimitive.Content dir="rtl" className={cn("fixed start-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-soft focus:outline-none dark:border-border-dark dark:bg-surface-dark", className)} {...props}>{children}<DialogPrimitive.Close aria-label="إغلاق" className="absolute left-4 top-4 rounded-lg p-1 text-muted hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-white/10"><X className="h-4 w-4" /></DialogPrimitive.Close></DialogPrimitive.Content></DialogPrimitive.Portal>;
}
