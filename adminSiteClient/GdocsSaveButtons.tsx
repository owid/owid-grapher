import { Badge, Button, Modal, Space, Spin } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faExclamationTriangle,
    faBolt,
    faClock,
} from "@fortawesome/free-solid-svg-icons"
import { GdocsDiff } from "./GdocsDiff.js"
import { OwidGdocErrorMessage, OwidGdoc } from "@ourworldindata/utils"
import { useState } from "react"

export const GdocsSaveButtons = ({
    published,
    originalGdoc,
    currentGdoc,
    errors,
    hasErrors,
    hasWarnings,
    hasChanges,
    isLightningUpdate,
    disableButtons,
    doPublish,
    saveDraft,
    calloutCount,
}: {
    published: boolean
    originalGdoc: OwidGdoc | undefined
    currentGdoc: OwidGdoc
    errors: OwidGdocErrorMessage[] | undefined
    hasErrors: boolean
    hasWarnings: boolean
    hasChanges: boolean
    isLightningUpdate: boolean
    disableButtons: boolean
    setDiffOpen: (open: boolean) => void
    doPublish: () => Promise<void>
    saveDraft: VoidFunction
    calloutCount: number
}) => {
    const [isPublishing, setIsPublishing] = useState(false)
    const hasCallouts = calloutCount > 0

    const formatPublishError = (error: unknown): string => {
        if (error instanceof Error && error.message) return error.message
        return String(error)
    }

    const confirmPublish = async () => {
        const styleDiff = hasChanges
            ? { style: { "overflow-y": "auto", maxHeight: "50vh" } }
            : {}
        const widthModal = hasChanges ? { width: "80vw" } : {}
        const centeredModal = hasChanges ? { centered: true } : {}

        const calloutTooltip = `This will regenerate ${calloutCount} data callout${
            calloutCount === 1 ? "" : "s"
        } and may take a minute.`

        const modal = Modal.confirm({
            title: `Are you sure you want to publish ${
                hasChanges ? "these changes" : "this article"
            }?`,
            content: (
                <>
                    {published && (
                        <div {...styleDiff}>
                            <GdocsDiff
                                originalGdoc={originalGdoc}
                                currentGdoc={currentGdoc}
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
            okButtonProps: hasCallouts
                ? {
                      icon: <FontAwesomeIcon icon={faClock} />,
                      title: calloutTooltip,
                  }
                : undefined,
            cancelText: "Cancel",
            onOk: async () => {
                if (isPublishing) return
                setIsPublishing(true)

                if (hasCallouts) {
                    modal.update({
                        title: "Publishing",
                        content: (
                            <Space>
                                <Spin size="small" />
                                <span>Generating data callouts…</span>
                            </Space>
                        ),
                        okText: "Publishing…",
                        okButtonProps: {
                            loading: true,
                            title: calloutTooltip,
                        },
                        cancelButtonProps: { disabled: true },
                    })
                }

                try {
                    await doPublish()
                    modal.destroy()
                } catch (error) {
                    modal.update({
                        title: "Publish failed",
                        content: (
                            <div>
                                Could not publish this document.{" "}
                                {formatPublishError(error)}
                            </div>
                        ),
                        okText: "Close",
                        okButtonProps: { loading: false },
                        cancelButtonProps: { style: { display: "none" } },
                    })
                } finally {
                    setIsPublishing(false)
                }
            },
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
                {!published && (
                    <Button
                        disabled={disableButtons || isPublishing || !hasChanges}
                        onClick={saveDraft}
                    >
                        Save draft
                    </Button>
                )}
                <Badge {...badgeProps}>
                    {/* #gdocsvalidationclient: prevent saving published articles with errors */}
                    <Button
                        disabled={
                            disableButtons ||
                            isPublishing ||
                            hasErrors ||
                            (published && !hasChanges)
                        }
                        type="primary"
                        onClick={confirmPublish}
                        title={
                            hasErrors
                                ? "This document has errors and can't be published until they're fixed"
                                : undefined
                        }
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
