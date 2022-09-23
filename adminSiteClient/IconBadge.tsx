import React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons/faExclamationTriangle"
import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons/faExclamationCircle"
import { ErrorMessageType } from "./gdocsValidation.js"
import { Badge } from "antd"

export const IconBadge = ({
    status,
    children,
}: {
    status: ErrorMessageType | null
    children: React.ReactNode
}) => {
    if (!status) return <>{children}</>

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
        <Badge count={<FontAwesomeIcon icon={icon} className={status} />}>
            {children}
        </Badge>
    )
}
