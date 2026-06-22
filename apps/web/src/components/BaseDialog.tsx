import { Dialog } from "@base-ui-components/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

type BaseDialogProps = {
  trigger: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
};

export function BaseDialog({
  trigger,
  title,
  description,
  children,
}: BaseDialogProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="dialog-trigger">{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="dialog-backdrop" />
        <Dialog.Popup className="dialog-popup">
          <div className="dialog-header">
            <div>
              <Dialog.Title className="dialog-title">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="dialog-description">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close className="dialog-close" aria-label="Close dialog">
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="dialog-body">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
