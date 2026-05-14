import type { ReactElement } from "react"
import { Popover, type PopoverProps } from "react-aria-components"
import { UNSAFE_PortalProvider } from "react-aria/PortalProvider"

export interface PortaledPopoverProps extends PopoverProps {
    portalContainer?: HTMLElement
}

// Popover wrapper that optionally portals overlays into a caller-provided DOM node.
// This is useful for cases where the popover is used inside an auto-closing element like a modal or drawer, and we want the auto-closing logic to be unchanged.
export function PortaledPopover({
    portalContainer,
    children,
    ...props
}: PortaledPopoverProps): ReactElement {
    const popover = <Popover {...props}>{children}</Popover>

    if (!portalContainer) return popover
    return (
        <UNSAFE_PortalProvider getContainer={() => portalContainer}>
            {popover}
        </UNSAFE_PortalProvider>
    )
}
