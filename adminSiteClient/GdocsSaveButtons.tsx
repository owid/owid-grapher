import { Button, Space } from "antd"
import React from "react"
import { GdocsPatch, GdocsPatchOp } from "../clientUtils/owidTypes.js"
import { ButtonBadge } from "./ButtonBadge.js"
import { ErrorMessageType } from "./gdocsValidation.js"

export const GdocsSaveButtons = ({
    published,
    hasErrors,
    hasWarnings,
    hasChanges,
    onSubmit,
}: {
    published: boolean
    hasErrors: boolean
    hasWarnings: boolean
    hasChanges: boolean
    onSubmit: (
        e: React.MouseEvent<HTMLElement>,
        overridePatch?: GdocsPatch[]
    ) => void
}) => {
    return (
        <Space>
            {!published && <Button onClick={onSubmit}>Save draft</Button>}
            {hasChanges && (
                <Button
                    disabled={hasErrors}
                    type="primary"
                    onClick={(e) =>
                        onSubmit(e, [
                            {
                                op: GdocsPatchOp.Update,
                                property: "published",
                                payload: true,
                            },
                        ])
                    }
                >
                    {published ? "Republish" : "Publish"}
                    {hasWarnings && (
                        <ButtonBadge status={ErrorMessageType.Warning} />
                    )}
                </Button>
            )}
        </Space>
    )
}
