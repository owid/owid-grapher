import * as React from "react"
import { notification } from "antd"
import { OwidGdocErrorMessageType } from "@ourworldindata/utils"
import { match } from "ts-pattern"

type NotificationType = "success" | "info" | OwidGdocErrorMessageType
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

type SuccessNotificationType = "draft" | "published" | "unpublished"

export const openSuccessNotification = (type: SuccessNotificationType) => {
    const content = match(type)
        .with("draft", () => "Your changes have been saved as a draft.")
        .with("published", () => (
            <>
                Your changes have been scheduled for publication.{" "}
                <a href="/admin/deploys" target="deploy">
                    Check deploy progress
                </a>
            </>
        ))
        .with("unpublished", () => (
            <>
                Your changes have been scheduled for unpublishing.{" "}
                <a href="/admin/deploys" target="deploy">
                    Check deploy progress
                </a>
            </>
        ))
        .exhaustive()

    openNotification("success", "Document saved", <span>{content}</span>)
}
