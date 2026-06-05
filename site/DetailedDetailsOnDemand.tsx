import { ReactNode, KeyboardEvent, useId, useState } from "react"
import cx from "classnames"
import { Modal, ModalOverlay, Dialog } from "react-aria-components"
import { faExpand } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { CloseButton } from "@ourworldindata/components"

export default function DetailedDetailsOnDemand({
    title,
    triggerText,
    children,
    className,
    triggerClassName,
}: {
    title: string
    triggerText: string
    children: ReactNode
    className?: string
    triggerClassName?: string
}) {
    const [isOpen, setIsOpen] = useState(false)
    const titleId = useId()

    const onTriggerKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            setIsOpen(true)
        }
    }

    return (
        <>
            <span
                className={cx(
                    "DetailedDetailsOnDemand__trigger",
                    triggerClassName
                )}
                role="button"
                tabIndex={0}
                aria-haspopup="dialog"
                onClick={() => setIsOpen(true)}
                onKeyDown={onTriggerKeyDown}
            >
                <span>{triggerText}</span>
                <FontAwesomeIcon
                    className="DetailedDetailsOnDemand__trigger-icon"
                    icon={faExpand}
                    aria-hidden
                />
            </span>
            <ModalOverlay
                className="DetailedDetailsOnDemand__overlay"
                isDismissable
                isOpen={isOpen}
                onOpenChange={setIsOpen}
            >
                <Modal className="DetailedDetailsOnDemand__modal">
                    <Dialog
                        aria-labelledby={titleId}
                        className={cx("DetailedDetailsOnDemand", className)}
                    >
                        {({ close }) => (
                            <>
                                <div className="DetailedDetailsOnDemand__header">
                                    <h3
                                        className="DetailedDetailsOnDemand__title"
                                        id={titleId}
                                    >
                                        {title}
                                    </h3>
                                    <CloseButton
                                        className="DetailedDetailsOnDemand__close-button"
                                        onClick={() => close()}
                                    />
                                </div>
                                <div className="DetailedDetailsOnDemand__content">
                                    {children}
                                </div>
                            </>
                        )}
                    </Dialog>
                </Modal>
            </ModalOverlay>
        </>
    )
}
