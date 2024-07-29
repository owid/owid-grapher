import React from "react"
import { CloseButton } from "@ourworldindata/components"

export function ModalHeader({
    title,
    onDismiss,
}: {
    title: string
    onDismiss?: () => void
}) {
    return (
        <div className="modal-header">
            <h2 className="grapher_h5-black-caps grapher_light">{title}</h2>
            {onDismiss && <CloseButton onClick={onDismiss} />}
        </div>
    )
}
