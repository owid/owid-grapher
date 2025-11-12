import { useEffect, useState } from "react"
import * as React from "react"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import {
    PageRecord,
    PagesIndexRecordsResponse,
    PagesIndexRecordsResponseSchema,
} from "@ourworldindata/types"
import { Alert, Card, Space, Spin, Typography, Tag } from "antd"
import { Link, RouteComponentProps } from "react-router-dom"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faAngleLeft } from "@fortawesome/free-solid-svg-icons"

const { Title } = Typography

interface GdocsAlgoliaPreviewMatchParams {
    id: string
}

export type GdocsAlgoliaPreviewMatchProps =
    RouteComponentProps<GdocsAlgoliaPreviewMatchParams>

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

export const GdocsAlgoliaPreview = ({
    match,
}: GdocsAlgoliaPreviewMatchProps) => {
    const { id } = match.params
    const { admin } = React.useContext(AdminAppContext)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [data, setData] = useState<PagesIndexRecordsResponse | null>(null)

    const gdocTitle =
        data && data.records.length > 0 ? data.records[0].title : null

    useEffect(() => {
        const fetchIndexRecords = async () => {
            setLoading(true)
            setError(null)

            try {
                const response = await admin.getJSON(`/api/gdocs/${id}/records`)
                const parsed = PagesIndexRecordsResponseSchema.parse(response)
                setData(parsed)
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err))
            } finally {
                setLoading(false)
            }
        }

        void fetchIndexRecords()
    }, [id, admin])

    return (
        <AdminLayout title="Algolia Index Preview">
            <div style={{ padding: 24 }}>
                <Space
                    direction="vertical"
                    size="large"
                    style={{ width: "100%" }}
                >
                    <div>
                        <Link to={`/gdocs/${id}/preview`}>
                            <FontAwesomeIcon icon={faAngleLeft} /> Back to
                            preview
                        </Link>
                    </div>

                    <Title level={2}>
                        Algolia Index Preview
                        {gdocTitle && `: ${gdocTitle}`}
                    </Title>

                    {loading && (
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
                            description={error}
                            type="error"
                            showIcon
                        />
                    )}

                    {data && !loading && (
                        <>
                            {data.message && (
                                <Alert
                                    message={data.message}
                                    type="info"
                                    showIcon
                                />
                            )}

                            {data.count > 0 && (
                                <>
                                    <Alert
                                        message={`This document will be split into ${data.count} searchable chunk${
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
            </div>
        </AdminLayout>
    )
}
