import { useContext, useEffect, useState } from "react"
import {
    Alert,
    Button,
    Flex,
    Modal,
    Spin,
    Table,
    Tag,
    Typography,
    notification,
} from "antd"
import {
    GdocComponentPreviewItem,
    GdocComponentPreviewRefreshResult,
    GdocComponentPreviewStatus,
    GdocComponentPreviewUpdateReason,
} from "@ourworldindata/types"
import { Admin } from "./Admin.js"
import { AdminAppContext } from "./AdminAppContext.js"

/** Labels for the dry run, which says what will happen */
const STATUS_LABELS: Record<
    GdocComponentPreviewStatus,
    { label: string; color: string; detail?: string }
> = {
    updated: { label: "Will update", color: "blue" },
    inserted: { label: "Will add", color: "green", detail: "No image yet" },
    upToDate: { label: "Up to date", color: "default" },
    imageBelow: {
        label: "Image below",
        color: "purple",
        detail: "Move it above to keep it updated",
    },
    unresolved: { label: "Not found", color: "orange" },
    failed: { label: "Failed", color: "red" },
}

const REASON_DETAILS: Record<GdocComponentPreviewUpdateReason, string> = {
    outdated: "Out of date",
    pastedByHand: "Pasted in by hand",
    wrongShape: "Cropped by a frame of the wrong shape",
}

function requestRefresh(
    admin: Admin,
    gdocId: string,
    dryRun: boolean
): Promise<GdocComponentPreviewRefreshResult> {
    return admin.requestJSON<GdocComponentPreviewRefreshResult>(
        `/api/gdocs/${gdocId}/refreshComponentPreviews`,
        { dryRun },
        "POST",
        { isBackground: true }
    )
}

function countChanges(items: GdocComponentPreviewItem[]): {
    updated: number
    inserted: number
    failed: number
} {
    const count = (status: GdocComponentPreviewStatus): number =>
        items.filter((item) => item.status === status).length
    return {
        updated: count("updated"),
        inserted: count("inserted"),
        failed: count("failed"),
    }
}

function pluralizeImages(count: number): string {
    return `${count} ${count === 1 ? "image" : "images"}`
}

function shortTarget(target: string): string {
    return target.replace(/^https:\/\/ourworldindata\.org/, "")
}

/**
 * Writes the images and reports the result in a notification, since the modal
 * is closed by then. Rendering is only checked when writing, so some images
 * can still fail; retrying is safe because up-to-date images are skipped.
 */
async function updateImages(
    admin: Admin,
    gdocId: string,
    notificationKey = `component-previews-${gdocId}`
): Promise<void> {
    const result = await requestRefresh(admin, gdocId, false)
    const { updated, inserted, failed } = countChanges(result.items)
    const changed = updated + inserted
    const docLink = (
        <a
            href={`https://docs.google.com/document/d/${gdocId}/edit`}
            target="_blank"
            rel="noopener"
        >
            Open the doc
        </a>
    )
    if (failed === 0) {
        notification.success({
            key: notificationKey,
            title: `Updated ${pluralizeImages(changed)}`,
            description: (
                <>
                    The Google Doc now shows the current version of each chart
                    and image. {docLink}
                </>
            ),
        })
        return
    }
    const failures = result.items.filter((item) => item.status === "failed")
    notification.warning({
        key: notificationKey,
        title: `${pluralizeImages(changed)} updated, ${failed} failed`,
        duration: 0,
        description: (
            <>
                {failures.map((item, index) => (
                    <div key={index}>
                        Couldn't update {shortTarget(item.target)}
                        {item.message && `: ${item.message}`}
                    </div>
                ))}
                Retrying usually works. Images that are already up to date are
                skipped.
            </>
        ),
        actions: (
            <Flex gap="small">
                <Button
                    size="small"
                    onClick={() => notification.destroy(notificationKey)}
                >
                    Dismiss
                </Button>
                <Button
                    size="small"
                    type="primary"
                    onClick={() => {
                        notification.info({
                            key: notificationKey,
                            title: "Updating images…",
                            duration: 0,
                        })
                        void updateImages(admin, gdocId, notificationKey).catch(
                            () => notification.destroy(notificationKey)
                        )
                    }}
                >
                    Retry
                </Button>
            </Flex>
        ),
    })
}

interface GdocsComponentPreviewsModalProps {
    gdocId: string
    /** Shown in the title where it's not clear which doc this is about */
    gdocTitle?: string
    isOpen: boolean
    onClose: () => void
}

/**
 * Shows what updating the preview images in a gdoc would do (a dry run, as
 * soon as it opens), and does it when the author confirms.
 */
export function GdocsComponentPreviewsModal(
    props: GdocsComponentPreviewsModalProps
) {
    // Mounted only while open, so each opening starts a fresh dry run
    if (!props.isOpen) return null
    return <ComponentPreviewsModal key={props.gdocId} {...props} />
}

function ComponentPreviewsModal({
    gdocId,
    gdocTitle,
    isOpen,
    onClose,
}: GdocsComponentPreviewsModalProps) {
    const { admin } = useContext(AdminAppContext)
    const [dryRun, setDryRun] = useState<GdocComponentPreviewRefreshResult>()
    const [hasDryRunFailed, setHasDryRunFailed] = useState(false)
    const [isUpdating, setIsUpdating] = useState(false)

    useEffect(() => {
        let isCurrent = true
        requestRefresh(admin, gdocId, true).then(
            (result) => {
                if (isCurrent) setDryRun(result)
            },
            // The admin shows the error itself
            () => {
                if (isCurrent) setHasDryRunFailed(true)
            }
        )
        return () => {
            isCurrent = false
        }
    }, [admin, gdocId])

    async function update() {
        setIsUpdating(true)
        try {
            await updateImages(admin, gdocId)
            onClose()
        } finally {
            setIsUpdating(false)
        }
    }

    const changes = dryRun ? countChanges(dryRun.items) : undefined
    const changeCount = changes ? changes.updated + changes.inserted : 0
    const hasNothingToUpdate = dryRun !== undefined && changeCount === 0

    const footer = (
        <Flex justify="space-between" align="center" gap="middle">
            <Typography.Text type="secondary">
                {changes && <ChangeSummary {...changes} />}
            </Typography.Text>
            {hasNothingToUpdate ? (
                <Button type="primary" onClick={onClose}>
                    Close
                </Button>
            ) : (
                <Flex gap="small">
                    <Button onClick={onClose}>Cancel</Button>
                    <Button
                        type="primary"
                        disabled={!dryRun}
                        loading={isUpdating}
                        onClick={update}
                    >
                        {dryRun
                            ? `Update ${pluralizeImages(changeCount)}`
                            : "Update images"}
                    </Button>
                </Flex>
            )}
        </Flex>
    )

    return (
        <Modal
            open={isOpen}
            title={
                gdocTitle
                    ? `Preview images in “${gdocTitle}”`
                    : "Preview images in the Google Doc"
            }
            footer={footer}
            onCancel={onClose}
            width={800}
            destroyOnHidden
        >
            <Typography.Paragraph type="secondary">
                The image above each chart, image and static viz component helps
                you see it while writing. Here's what updating them (in all
                tabs) would do. Nothing changes in the doc until you click
                Update.
            </Typography.Paragraph>
            {dryRun ? (
                <ComponentPreviewTable items={dryRun.items} />
            ) : hasDryRunFailed ? (
                <Alert
                    type="error"
                    title="Couldn't check the images in the doc."
                />
            ) : (
                <Flex vertical align="center" gap="small">
                    <Spin />
                    <Typography.Text type="secondary">
                        Checking the images in the doc…
                    </Typography.Text>
                </Flex>
            )}
        </Modal>
    )
}

function ChangeSummary({
    updated,
    inserted,
}: {
    updated: number
    inserted: number
}) {
    if (updated + inserted === 0) return <>Nothing to update</>
    return (
        <>
            {[
                updated > 0 && `${updated} to update`,
                inserted > 0 && `${inserted} to add`,
            ]
                .filter(Boolean)
                .join(", ")}
        </>
    )
}

function ComponentPreviewTable({
    items,
}: {
    items: GdocComponentPreviewItem[]
}) {
    if (items.length === 0)
        return (
            <Alert
                type="info"
                title="This document doesn't contain any chart, image or static viz components."
            />
        )
    return (
        <Table
            size="small"
            pagination={false}
            tableLayout="fixed"
            dataSource={items.map((item, index) => ({ ...item, key: index }))}
            columns={[
                { title: "Tab", dataIndex: "tabTitle", width: 150 },
                {
                    title: "Shows",
                    dataIndex: "target",
                    ellipsis: true,
                    render: (target: string) => (
                        <Typography.Text ellipsis={{ tooltip: target }}>
                            {shortTarget(target)}
                        </Typography.Text>
                    ),
                },
                {
                    title: "What will happen",
                    dataIndex: "status",
                    width: 320,
                    render: (status: GdocComponentPreviewStatus, item) => {
                        const { label, color, detail } = STATUS_LABELS[status]
                        const details = [
                            item.reason ? REASON_DETAILS[item.reason] : detail,
                            item.message,
                        ].filter(Boolean)
                        return (
                            <>
                                <Tag color={color}>{label}</Tag>
                                {details.length > 0 && (
                                    <Typography.Text type="secondary">
                                        {details.join(". ")}
                                    </Typography.Text>
                                )}
                            </>
                        )
                    },
                },
            ]}
        />
    )
}
