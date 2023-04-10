import React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    faExclamationTriangle,
    faExclamationCircle,
} from "@fortawesome/free-solid-svg-icons"
import { OwidDocumentErrorMessageType } from "@ourworldindata/utils"
import { Badge } from "antd"

export const IconBadge = ({
    status,
    children,
}: {
    status: OwidDocumentErrorMessageType | null
    children: React.ReactNode
}) => {
    if (!status) return <>{children}</>

    let icon
    switch (status) {
        case OwidDocumentErrorMessageType.Warning:
            icon = faExclamationTriangle
            break
        case OwidDocumentErrorMessageType.Error:
            icon = faExclamationCircle
            break
    }

    return (
        <Badge count={<FontAwesomeIcon icon={icon} className={status} />}>
            {children}
        </Badge>
    )
}
