import React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    faExclamationTriangle,
    faExclamationCircle,
} from "@fortawesome/free-solid-svg-icons"
import { OwidGdocErrorMessageType } from "@ourworldindata/utils"
import { Badge } from "antd"

export const IconBadge = ({
    status,
    children,
}: {
    status: OwidGdocErrorMessageType | null
    children: React.ReactNode
}) => {
    if (!status) return <>{children}</>

    let icon
    switch (status) {
        case OwidGdocErrorMessageType.Warning:
            icon = faExclamationTriangle
            break
        case OwidGdocErrorMessageType.Error:
            icon = faExclamationCircle
            break
    }

    return (
        <Badge count={<FontAwesomeIcon icon={icon} className={status} />}>
            {children}
        </Badge>
    )
}
