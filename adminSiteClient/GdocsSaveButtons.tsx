import { Badge, Button, Modal, Space } from "antd"
import React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons/faExclamationTriangle"
import { faBolt } from "@fortawesome/free-solid-svg-icons/faBolt"
import { ErrorMessage } from "./gdocsValidation.js"
import { GdocsDiff } from "./GdocsDiff.js"
import { OwidArticleType } from "@ourworldindata/utils"

export const GdocsSaveButtons = ({
    published,
    originalGdoc,
    gdoc,
    errors,
    hasErrors,
    hasWarnings,
    hasChanges,
    isLightningUpdate,
    doPublish,
}: {
    published: boolean
    originalGdoc: OwidArticleType | undefined
    gdoc: OwidArticleType
    errors: ErrorMessage[] | undefined
    hasErrors: boolean
    hasWarnings: boolean
    hasChanges: boolean
    isLightningUpdate: boolean
    setDiffOpen: (open: boolean) => void
    doPublish: VoidFunction
}) => {
    const confirmPublish = async () => {
        const styleDiff = hasChanges
            ? { style: { "overflow-y": "auto", maxHeight: "50vh" } }
            : {}
        const widthModal = hasChanges ? { width: "80vw" } : {}
        const centeredModal = hasChanges ? { centered: true } : {}

        Modal.confirm({
            title: `Are you sure you want to publish ${
                hasChanges ? "these changes" : "this article"
            }?`,
            content: (
                <>
                    {published && (
                        <div {...styleDiff}>
                            <GdocsDiff
                                originalGdoc={originalGdoc}
                                gdoc={gdoc}
                            />
                        </div>
                    )}
                    {hasWarnings && (
                        <div className="mt-3">
                            {errors?.map((error, i) => (
                                <div key={i}>
                                    <FontAwesomeIcon
                                        icon={faExclamationTriangle}
                                        color="#faad14"
                                    />{" "}
                                    {error.message}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            ),
            okType: hasWarnings ? "danger" : "primary",
            okText: "Publish now",
            cancelText: "Cancel",
            onOk: doPublish,
            maskClosable: true,
            ...centeredModal,
            ...widthModal,
        })
    }

    const badgeProps =
        hasWarnings && !hasErrors
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
        <>
            <Space>
                <Badge {...badgeProps}>
                    {/* #gdocsvalidationclient: prevent saving published articles with errors */}
                    <Button
                        disabled={hasErrors || (published && !hasChanges)}
                        type="primary"
                        onClick={confirmPublish}
                    >
                        {!published ? (
                            "Publish"
                        ) : isLightningUpdate ? (
                            <>
                                <FontAwesomeIcon icon={faBolt} /> Republish
                            </>
                        ) : (
                            "Republish"
                        )}
                    </Button>
                </Badge>
            </Space>
        </>
    )
}
