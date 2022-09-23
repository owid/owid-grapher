import { Badge, Button, Space } from "antd"
import React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons/faExclamationTriangle"

export const GdocsSaveButtons = ({
    published,
    hasErrors,
    hasWarnings,
    hasChanges,
    onPublish,
}: {
    published: boolean
    hasErrors: boolean
    hasWarnings: boolean
    hasChanges: boolean
    onPublish: VoidFunction
}) => {
    const badgeProps =
        hasChanges && published
            ? { dot: true }
            : hasWarnings && !hasErrors
            ? {
                  count: (
                      <FontAwesomeIcon
                          icon={faExclamationTriangle}
                          className="warning"
                      />
                  ),
              }
            : {}
    return (
        <Space>
            <Badge {...badgeProps}>
                <Button disabled={hasErrors} type="primary" onClick={onPublish}>
                    {published ? "Republish" : "Publish"}
                </Button>
            </Badge>
        </Space>
    )
}
