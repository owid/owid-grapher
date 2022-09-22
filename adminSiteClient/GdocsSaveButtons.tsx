import { Button, Space } from "antd"
import React from "react"
import { ButtonBadge } from "./ButtonBadge.js"
import { ErrorMessageType } from "./gdocsValidation.js"
import { faCircle } from "@fortawesome/free-solid-svg-icons/faCircle"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"

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
    return (
        <Space>
            <Button disabled={hasErrors} type="primary" onClick={onPublish}>
                {published ? "Republish" : "Publish"}
                {hasChanges && published ? (
                    <FontAwesomeIcon
                        icon={faCircle}
                        size="xs"
                        style={{
                            color: "red",
                            position: "absolute",
                            top: "-0.5em",
                            right: "-0.5em",
                        }}
                    />
                ) : (
                    hasWarnings &&
                    !hasErrors && (
                        <ButtonBadge status={ErrorMessageType.Warning} />
                    )
                )}
            </Button>
        </Space>
    )
}
