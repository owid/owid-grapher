import type * as React from "react"
import { UNSAFE_PortalProvider } from "react-aria"
import { Dialog, Modal, ModalOverlay } from "react-aria-components"

interface SlideInDrawerProps {
    isOpen: boolean
    onOpenChange: (isOpen: boolean) => void
    ariaLabel: string
    children: React.ReactNode
    grapherRef: React.RefObject<HTMLDivElement | null>
}

export function SlideInDrawer({
    isOpen,
    onOpenChange,
    ariaLabel,
    children,
    grapherRef,
}: SlideInDrawerProps): React.ReactElement {
    return (
        <UNSAFE_PortalProvider getContainer={() => grapherRef.current}>
            <ModalOverlay
                className="drawer"
                isOpen={isOpen}
                onOpenChange={onOpenChange}
                isDismissable
            >
                <Modal className="drawer-contents">
                    <Dialog aria-label={ariaLabel} className="drawer-dialog">
                        {/* Restore the default portal container for nested
                            overlays such as the entity selector's dropdowns. */}
                        <UNSAFE_PortalProvider getContainer={null}>
                            {children}
                        </UNSAFE_PortalProvider>
                    </Dialog>
                </Modal>
            </ModalOverlay>
        </UNSAFE_PortalProvider>
    )
}
