import { useContext } from "react"
import { AdminAppContext } from "./AdminAppContext.js"
import {
    PageRecord,
    PagesIndexRecordsResponse,
    PagesIndexRecordsResponseSchema,
} from "@ourworldindata/types"
import { Alert, Card, Space, Spin, Tag } from "antd"
import { useQuery } from "@tanstack/react-query"

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
            <pre
                style={{
                    background: "#f5f5f5",
                    padding: 16,
                    borderRadius: 4,
                    overflow: "auto",
                    fontSize: 12,
                    margin: 0,
                }}
            >
                {JSON.stringify(record, null, 2)}
            </pre>
        </Card>
    )
}

export const GdocsRecordsPreview = ({
    gdocId,
    open,
}: {
    gdocId: string
    open: boolean
}) => {
    const { admin } = useContext(AdminAppContext)

    const { data, isFetching, error } = useQuery({
        queryKey: ["gdocRecords", gdocId],
        enabled: open,
        queryFn: async (): Promise<PagesIndexRecordsResponse> => {
            const response = await admin.getJSON(`/api/gdocs/${gdocId}/records`)
            return PagesIndexRecordsResponseSchema.parse(response)
        },
        staleTime: 60 * 1000,
    })

    return (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
            {isFetching && (
                <div style={{ textAlign: "center", padding: 48 }}>
                    <Spin size="large" />
                    <div style={{ marginTop: 16 }}>
                        Generating index records...
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

            {data && !isFetching && (
                <>
                    {data.message && (
                        <Alert message={data.message} type="info" showIcon />
                    )}

                    {data.count > 0 && (
                        <>
                            <Alert
                                message={`This document will be split into ${data.count} searchable records${
                                    data.count === 1 ? "" : "s"
                                } in Algolia`}
                                type="success"
                                showIcon
                            />

                            <div>
                                {data.records.map((record, index) => (
                                    <RecordCard
                                        key={record.objectID}
                                        record={record}
                                        index={index}
                                    />
                                ))}
                            </div>
                        </>
                    )}

                    {data.count === 0 && !data.message && (
                        <Alert
                            message="No records would be generated"
                            description="This document has no indexable content"
                            type="warning"
                            showIcon
                        />
                    )}
                </>
            )}
        </Space>
    )
}
