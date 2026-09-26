import { Popover } from "@base-ui/react/popover";
import type { ReactNode } from "react";

export function InfoPopover({
  trigger,
  label,
  title,
  children,
  className,
}: {
  trigger: ReactNode;
  label: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        className={className}
        aria-label={label}
        openOnHover
        delay={250}
        closeDelay={120}
      >
        {trigger}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          className="rr-popup-positioner"
          side="top"
          sideOffset={8}
        >
          <Popover.Popup className="rr-popup rr-info-popup">
            <Popover.Title>{title}</Popover.Title>
            <Popover.Description>{children}</Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
