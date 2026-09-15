import { useLayoutEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { Dialog, Modal, ModalOverlay } from "react-aria-components"
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core"
import { faTimes } from "@fortawesome/free-solid-svg-icons"
import { SiteToolsButton } from "./SiteToolsButton.js"

export function SiteToolsDialog({
    isOpen,
    onOpenChange,
    className,
    label,
    closeLabel,
    icon,
    dataTrackNote,
    children,
}: {
    isOpen: boolean
    onOpenChange: (isOpen: boolean) => void
    className: string
    label: string
    closeLabel: string
    icon: IconDefinition
    dataTrackNote: string
    children: ReactNode
}) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [position, setPosition] = useState<{ left: number; bottom: number }>()

    useLayoutEffect(() => {
        if (!isOpen) return

        const updatePosition = () => {
            const bounds = containerRef.current?.getBoundingClientRect()
            if (bounds?.width === 0) {
                onOpenChange(false)
            } else if (bounds) {
                setPosition({
                    left: bounds.left,
                    bottom: window.innerHeight - bounds.bottom,
                })
            }
        }
        updatePosition()
        window.addEventListener("resize", updatePosition)
        return () => window.removeEventListener("resize", updatePosition)
    }, [isOpen, onOpenChange])

    return (
        <div ref={containerRef} className={className}>
            <SiteToolsButton
                icon={icon}
                label={label}
                dataTrackNote={dataTrackNote}
                onClick={() => onOpenChange(true)}
            />
            <ModalOverlay
                className="site-tools__modal-overlay"
                isOpen={isOpen && position !== undefined}
                onOpenChange={onOpenChange}
                isDismissable
            >
                {/* Align the close button with its trigger, while the form
                    stays aligned with the right edge of the tool group. */}
                <Modal className="site-tools__modal" style={position}>
                    <Dialog className="site-tools__dialog" aria-label={label}>
                        <div className="site-tools__box">{children}</div>
                        <SiteToolsButton
                            icon={faTimes}
                            label={closeLabel}
                            tooltip={false}
                            onClick={() => onOpenChange(false)}
                        />
                    </Dialog>
                </Modal>
            </ModalOverlay>
        </div>
    )
}
