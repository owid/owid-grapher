import { useContext, useState } from "react"
import { Alert, Checkbox, Modal, Table, Tag, Typography } from "antd"
import {
    GdocChartPreviewItem,
    GdocChartPreviewRefreshResult,
    GdocChartPreviewStatus,
} from "@ourworldindata/types"
import { AdminAppContext } from "./AdminAppContext.js"

const STATUS_LABELS: Record<
    GdocChartPreviewStatus,
    { label: string; color: string }
> = {
    updated: { label: "Updated", color: "green" },
    inserted: { label: "Added", color: "green" },
    upToDate: { label: "Up to date", color: "default" },
    missing: { label: "No image", color: "default" },
    unresolved: { label: "Unknown chart", color: "orange" },
    failed: { label: "Failed", color: "red" },
}

export function GdocsChartPreviewsModal({
    gdocId,
    gdocTitle,
    isOpen,
    onClose,
}: {
    gdocId: string
    /** Shown in the title where it's not clear which doc this is about */
    gdocTitle?: string
    isOpen: boolean
    onClose: () => void
}) {
    const { admin } = useContext(AdminAppContext)
    const [insertMissing, setInsertMissing] = useState(false)
    const [isRunning, setIsRunning] = useState(false)
    const [result, setResult] = useState<GdocChartPreviewRefreshResult>()

    async function refresh() {
        setIsRunning(true)
        try {
            const response =
                await admin.requestJSON<GdocChartPreviewRefreshResult>(
                    `/api/gdocs/${gdocId}/refreshChartPreviews`,
                    { insertMissing },
                    "POST",
                    { isBackground: true }
                )
            setResult(response)
        } finally {
            setIsRunning(false)
        }
    }

    function close() {
        setResult(undefined)
        onClose()
    }

    return (
        <Modal
            open={isOpen}
            title={
                gdocTitle
                    ? `Chart images in “${gdocTitle}”`
                    : "Chart images in the Google Doc"
            }
            okText={result ? "Done" : "Update images"}
            onOk={result ? close : refresh}
            confirmLoading={isRunning}
            cancelButtonProps={{ style: result ? { display: "none" } : {} }}
            onCancel={close}
            width={result ? 800 : undefined}
            destroyOnHidden
        >
            {result ? (
                <ChartPreviewResults items={result.items} />
            ) : (
                <>
                    <Typography.Paragraph>
                        Replaces the image right above each chart component in
                        the Google Doc (in all tabs) with a current rendering of
                        the chart, if it's outdated or was pasted in by hand.
                    </Typography.Paragraph>
                    <Checkbox
                        checked={insertMissing}
                        onChange={(e) => setInsertMissing(e.target.checked)}
                    >
                        Also add images to chart components that don't have one
                    </Checkbox>
                </>
            )}
        </Modal>
    )
}

function ChartPreviewResults({ items }: { items: GdocChartPreviewItem[] }) {
    if (items.length === 0)
        return (
            <Alert
                type="info"
                title="This document doesn't contain any chart components."
            />
        )
    return (
        <Table
            size="small"
            pagination={false}
            tableLayout="fixed"
            dataSource={items.map((item, index) => ({ ...item, key: index }))}
            columns={[
                { title: "Tab", dataIndex: "tabTitle", width: 120 },
                {
                    title: "Chart",
                    dataIndex: "target",
                    ellipsis: true,
                    render: (target: string) => (
                        <Typography.Text ellipsis={{ tooltip: target }}>
                            {target.replace(
                                /^https:\/\/ourworldindata\.org/,
                                ""
                            )}
                        </Typography.Text>
                    ),
                },
                {
                    title: "Status",
                    dataIndex: "status",
                    width: 280,
                    render: (status: GdocChartPreviewStatus, item) => (
                        <>
                            <Tag color={STATUS_LABELS[status].color}>
                                {STATUS_LABELS[status].label}
                            </Tag>
                            {item.message && (
                                <Typography.Text type="secondary">
                                    {item.message}
                                </Typography.Text>
                            )}
                        </>
                    ),
                },
            ]}
        />
    )
}
