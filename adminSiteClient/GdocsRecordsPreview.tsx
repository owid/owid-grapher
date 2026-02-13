import { useContext } from "react"
import { AdminAppContext } from "./AdminAppContext.js"
import {
    PageRecord,
    PagesIndexRecordsResponse,
    PagesIndexRecordsResponseSchema,
} from "@ourworldindata/types"
import { Alert, Card, Radio, Space, Spin, Tag } from "antd"
import { useQuery } from "@tanstack/react-query"
import JSONView from "@uiw/react-json-view"

const RecordCard = ({
    record,
    index,
}: {
    record: PageRecord
    index: number
}) => {
    return (
        <Card
            title={
                <Space>
                    <Tag color="blue">Record {index + 1}</Tag>
                </Space>
            }
            style={{ marginBottom: 16 }}
            size="small"
        >
            <div
                style={{
                    background: "#f5f5f5",
                    padding: 16,
                    borderRadius: 4,
                    overflow: "auto",
                    fontSize: 12,
                }}
            >
                <JSONView value={record} />
            </div>
        </Card>
    )
}

export type RecordsPreviewMode = "records" | "plaintext"

export const RecordsPreviewModeToggle = ({
    mode,
    onChange,
}: {
    mode: RecordsPreviewMode
    onChange: (mode: RecordsPreviewMode) => void
}) => (
    <Radio.Group
        value={mode}
        onChange={(e) => onChange(e.target.value)}
        optionType="button"
        buttonStyle="solid"
        size="small"
    >
        <Radio.Button value="records">Algolia records</Radio.Button>
        <Radio.Button value="plaintext">Plain text</Radio.Button>
    </Radio.Group>
)

export const GdocsRecordsPreview = ({
    gdocId,
    open,
    mode,
}: {
    gdocId: string
    open: boolean
    mode: RecordsPreviewMode
}) => {
    const { admin } = useContext(AdminAppContext)

    const recordsQuery = useQuery({
        queryKey: ["gdocRecords", gdocId],
        enabled: open && mode === "records",
        queryFn: async (): Promise<PagesIndexRecordsResponse> => {
            const response = await admin.getJSON(`/api/gdocs/${gdocId}/records`)
            return PagesIndexRecordsResponseSchema.parse(response)
        },
        staleTime: 60 * 1000,
    })

    const plaintextQuery = useQuery({
        queryKey: ["gdocPlaintext", gdocId],
        enabled: open && mode === "plaintext",
        queryFn: async (): Promise<{ plaintext: string | undefined }> => {
            return admin.getJSON(
                `/api/gdocs/${gdocId}/records?raw=true`
            ) as Promise<{ plaintext: string | undefined }>
        },
        staleTime: 60 * 1000,
    })

    const activeQuery = mode === "records" ? recordsQuery : plaintextQuery
    const isFetching = activeQuery.isFetching
    const error = activeQuery.error

    return (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
            {isFetching && (
                <div style={{ textAlign: "center", padding: 48 }}>
                    <Spin size="large" />
                    <div style={{ marginTop: 16 }}>
                        {mode === "records"
                            ? "Generating index records..."
                            : "Extracting plain text..."}
                    </div>
                </div>
            )}

            {error && (
                <Alert
                    message="Error"
                    description={
                        error instanceof Error ? error.message : String(error)
                    }
                    type="error"
                    showIcon
                />
            )}

            {mode === "records" && recordsQuery.data && !isFetching && (
                <>
                    {recordsQuery.data.message && (
                        <Alert
                            message={recordsQuery.data.message}
                            type="info"
                            showIcon
                        />
                    )}

                    {recordsQuery.data.count > 0 && (
                        <>
                            <Alert
                                message={`This document will be split into ${recordsQuery.data.count} searchable record${
                                    recordsQuery.data.count === 1 ? "" : "s"
                                } in Algolia`}
                                type="success"
                                showIcon
                            />

                            <div>
                                {recordsQuery.data.records.map(
                                    (record, index) => (
                                        <RecordCard
                                            key={record.objectID}
                                            record={record}
                                            index={index}
                                        />
                                    )
                                )}
                            </div>
                        </>
                    )}

                    {recordsQuery.data.count === 0 &&
                        !recordsQuery.data.message && (
                            <Alert
                                message="No records would be generated"
                                description="This document has no indexable content"
                                type="warning"
                                showIcon
                            />
                        )}
                </>
            )}

            {mode === "plaintext" && plaintextQuery.data && !isFetching && (
                <Card size="small">
                    {plaintextQuery.data.plaintext ? (
                        <pre
                            style={{
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                                margin: 0,
                                fontSize: 13,
                                lineHeight: 1.6,
                                maxHeight: "70vh",
                                overflow: "auto",
                            }}
                        >
                            {plaintextQuery.data.plaintext}
                        </pre>
                    ) : (
                        <Alert
                            message="No plain text content"
                            description="This document has no extractable text content"
                            type="warning"
                            showIcon
                        />
                    )}
                </Card>
            )}
        </Space>
    )
}
