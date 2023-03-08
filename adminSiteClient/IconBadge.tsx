import React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons/faExclamationTriangle"
import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons/faExclamationCircle"
import { OwidArticleErrorMessageType } from "@ourworldindata/utils"
import { Badge } from "antd"

export const IconBadge = ({
    status,
    children,
}: {
    status: OwidArticleErrorMessageType | null
    children: React.ReactNode
}) => {
    if (!status) return <>{children}</>

    let icon
    switch (status) {
        case OwidArticleErrorMessageType.Warning:
            icon = faExclamationTriangle
            break
        case OwidArticleErrorMessageType.Error:
            icon = faExclamationCircle
            break
    }

    return (
        <Badge count={<FontAwesomeIcon icon={icon} className={status} />}>
            {children}
        </Badge>
    )
}
