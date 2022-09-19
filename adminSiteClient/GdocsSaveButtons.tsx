import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons/faExclamationTriangle"
import { faCircle } from "@fortawesome/free-solid-svg-icons/faCircle"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { Button, Space } from "antd"
import React from "react"
import { GdocsPatch, GdocsPatchOp } from "../clientUtils/owidTypes.js"

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
                {published ? "Update" : "Publish"}
                {hasWarnings && (
                    <>
                        <FontAwesomeIcon
                            icon={faExclamationTriangle}
                            color="orange"
                            style={{ marginLeft: "0.5em" }}
                        />
                    </>
                )}
                {hasChanges && (
                    <>
                        <FontAwesomeIcon
                            icon={faCircle}
                            color="red"
                            style={{
                                position: "absolute",
                                top: "-0.5em",
                                right: "-0.5em",
                            }}
                        />
                    </>
                )}
            </Button>
        </Space>
    )
}
