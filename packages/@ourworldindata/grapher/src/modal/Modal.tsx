import * as React from "react"
import { UNSAFE_PortalProvider } from "react-aria"
import { Dialog, Modal as AriaModal, ModalOverlay } from "react-aria-components"
import { Bounds } from "@ourworldindata/utils"

interface ModalProps {
    bounds: Bounds
    onDismiss: () => void
    ariaLabel: string
    grapherRef: React.RefObject<HTMLDivElement | null>
    children?: React.ReactNode
    /** By default the modal height fits its content */
    isHeightFixed?: boolean
    alignVertical?: "top" | "center" | "bottom"
}

export function Modal({
    bounds,
    onDismiss,
    ariaLabel,
    grapherRef,
    children,
    isHeightFixed = false,
    alignVertical = "center",
}: ModalProps): React.ReactElement {
    const contentStyle: React.CSSProperties = {
        left: bounds.left,
        width: bounds.width,
        maxHeight: bounds.height,
    }

    if (isHeightFixed) {
        contentStyle.height = bounds.height
    }

    if (alignVertical === "bottom") {
        contentStyle.bottom = bounds.y
    } else if (alignVertical === "top") {
        contentStyle.top = bounds.y
    } else {
        contentStyle.top = "50%"
        contentStyle.transform = "translateY(-50%)"
    }

    return (
        <UNSAFE_PortalProvider getContainer={() => grapherRef.current}>
            <ModalOverlay
                className="modal-overlay"
                isOpen
                onOpenChange={(isOpen) => {
                    if (!isOpen) onDismiss()
                }}
                isDismissable
            >
                <AriaModal className="modal-content" style={contentStyle}>
                    <Dialog className="modal-dialog" aria-label={ariaLabel}>
                        {/* Restore the default portal container for nested
                            overlays such as dropdowns. */}
                        <UNSAFE_PortalProvider getContainer={null}>
                            {children}
                        </UNSAFE_PortalProvider>
                    </Dialog>
                </AriaModal>
            </ModalOverlay>
        </UNSAFE_PortalProvider>
    )
}
