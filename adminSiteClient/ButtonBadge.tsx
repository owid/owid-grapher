import React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons/faExclamationTriangle"
import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons/faExclamationCircle"
import { ErrorMessageType } from "./gdocsValidation.js"

export const ButtonBadge = ({ status }: { status: ErrorMessageType }) => {
    let icon

    switch (status) {
        case ErrorMessageType.Warning:
            icon = faExclamationTriangle
            break
        case ErrorMessageType.Error:
            icon = faExclamationCircle
            break
    }

    return (
        <FontAwesomeIcon
            icon={icon}
            className={status}
            style={{
                position: "absolute",
                top: "-0.5em",
                right: "-0.5em",
            }}
        />
    )
}
