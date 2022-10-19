import React from "react"
import { notification } from "antd"
import { ErrorMessageType } from "./gdocsValidation.js"

type NotificationType = "success" | "info" | ErrorMessageType
const openNotification = (
    type: NotificationType,
    title: string,
    description: React.ReactNode
) => {
    notification[type]({
        message: title,
        description,
        placement: "bottomLeft",
        closeIcon: <></>,
    })
}

export const openSuccessNotification = () => {
    openNotification(
        "success",
        "Document saved",
        <span>
            Your changes have been scheduled for publication.{" "}
            <a href="/admin/deploys" target="deploy">
                Check deploy progress
            </a>
        </span>
    )
}
