import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { useTranslation } from "next-i18next"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({
  ...props
}) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  ...props
}) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props} />
  );
}

// ⚠️ This primitive reads i18n, and that is deliberate rather than a leak.
//
// "components/ui/* must not know about translations" is a LIBRARY's rule — it
// exists because a library is shipped to callers who bring their own language.
// This is not a library: it is one product, in one language, with exactly one
// copy of these files in this repo.
//
// The alternative — a closeLabel prop — makes forgetting possible at all 34
// call sites, and the wrong default stays SILENT because sr-only text is never
// seen. It is a defect only somebody who cannot see the screen would hit, and
// they are the last person able to report it.
//
// Every page loads the 'common' namespace (measured: all seven), so the key
// resolves wherever a dialog can open.
function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}) {
  const { t } = useTranslation('common')
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 start-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 rtl:translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}>
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button variant="ghost" className="absolute top-2 end-2" size="icon-sm" />
            }>
            <XIcon />
            <span className="sr-only">{t('common:close')}</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({
  className,
  ...props
}) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props} />
  );
}

// ⚠️ A SECOND untranslated "Close" lived here, and a hand-written grep for
// >Close< missed it because the word sits on its own line. The shape guard in
// lib/uiPrimitivesHaveNoWords.test.js found it on first run — which is the
// argument for matching a shape over reading a file.
//
// This one is not sr-only: with showCloseButton it draws a visible English
// button in an Arabic footer. Nothing passes that flag today, so it has never
// appeared — a defect waiting for its first caller.
function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}) {
  const { t } = useTranslation('common')
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}>
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          {t('common:close')}
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({
  className,
  ...props
}) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("font-heading text-base leading-none font-medium", className)}
      {...props} />
  );
}

function DialogDescription({
  className,
  ...props
}) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props} />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
