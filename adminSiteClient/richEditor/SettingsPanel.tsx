import { useContext, useState } from "react"
import { Alert, Button, Form, Input, Select, Space, Typography } from "antd"
import { OwidGdocContent, OwidGdocType } from "@ourworldindata/types"
import {
    RichEditorSaveBodyResponse,
    RichEditorSaveSettingsRequest,
} from "../../adminShared/RichEditorTypes.js"
import { AdminAppContext } from "../AdminAppContext.js"

interface SettingsFormValues {
    title: string
    authors: string[]
    slug: string
    grapherUrl?: string
    narrativeChart?: string
    figmaUrl?: string
}

/**
 * Right-rail form for the non-body document settings. Saves go through the
 * same draft/revision mechanics as body saves, so History covers settings
 * changes too.
 */
export function SettingsPanel(props: {
    gdocId: string
    docType: OwidGdocType
    published: boolean
    content: OwidGdocContent
    slug: string
    getBaseRevisionId: () => number | null
    onSaved: (revisionId: number, values: SettingsFormValues) => void
}): React.ReactElement {
    const { gdocId, docType, published, content, slug, getBaseRevisionId } =
        props
    const { admin } = useContext(AdminAppContext)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const isDataInsight = docType === OwidGdocType.DataInsight

    const contentFields = content as unknown as Record<string, unknown>
    const initialValues: SettingsFormValues = {
        title: content.title ?? "",
        authors: content.authors ?? [],
        slug,
        grapherUrl: contentFields["grapher-url"] as string | undefined,
        narrativeChart: contentFields["narrative-chart"] as string | undefined,
        figmaUrl: contentFields["figma-url"] as string | undefined,
    }

    const onFinish = async (values: SettingsFormValues): Promise<void> => {
        setSaving(true)
        setError(null)
        try {
            const request: RichEditorSaveSettingsRequest = {
                settings: {
                    title: values.title,
                    authors: values.authors,
                    ...(isDataInsight
                        ? {
                              "grapher-url": values.grapherUrl || null,
                              "narrative-chart": values.narrativeChart || null,
                              "figma-url": values.figmaUrl || null,
                          }
                        : {}),
                },
                slug: values.slug,
                baseRevisionId: getBaseRevisionId(),
            }
            const response = await admin.rawRequest(
                `/api/gdocs/${gdocId}/editorSettings`,
                JSON.stringify(request),
                "PUT"
            )
            if (response.status === 409) {
                setError(
                    "Someone else saved a newer version of this draft. Reload before changing settings."
                )
                return
            }
            if (!response.ok) {
                const payload = await response.json().catch(() => ({}))
                setError(
                    payload?.error?.message ??
                        `Saving settings failed (${response.status})`
                )
                return
            }
            const saved = (await response.json()) as RichEditorSaveBodyResponse
            props.onSaved(saved.revisionId, values)
        } catch (saveError) {
            setError(String(saveError))
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="rich-editor-rail__panel">
            <Typography.Title level={5}>Settings</Typography.Title>
            {error && (
                <Alert
                    type="error"
                    showIcon
                    message={error}
                    style={{ marginBottom: 12 }}
                />
            )}
            <Form<SettingsFormValues>
                layout="vertical"
                size="small"
                initialValues={initialValues}
                onFinish={(values) => void onFinish(values)}
            >
                <Form.Item
                    label="Title"
                    name="title"
                    rules={[{ required: true }]}
                >
                    <Input.TextArea autoSize />
                </Form.Item>
                <Form.Item
                    label="Authors"
                    name="authors"
                    rules={[{ required: true }]}
                >
                    <Select
                        mode="tags"
                        tokenSeparators={[","]}
                        placeholder="Author names"
                        open={false}
                    />
                </Form.Item>
                <Form.Item
                    label="Slug"
                    name="slug"
                    rules={[{ required: true }]}
                    extra={
                        published
                            ? "The slug of a published document cannot be changed here."
                            : undefined
                    }
                >
                    <Input disabled={published} />
                </Form.Item>
                {isDataInsight && (
                    <>
                        <Form.Item
                            label="Grapher URL"
                            name="grapherUrl"
                            extra="Chart the insight is based on; shown as the data source."
                        >
                            <Input placeholder="https://ourworldindata.org/grapher/…" />
                        </Form.Item>
                        <Form.Item
                            label="Narrative chart"
                            name="narrativeChart"
                        >
                            <Input placeholder="Name of a narrative chart" />
                        </Form.Item>
                        <Form.Item label="Figma URL" name="figmaUrl">
                            <Input placeholder="https://www.figma.com/…" />
                        </Form.Item>
                    </>
                )}
                <Space>
                    <Button type="primary" htmlType="submit" loading={saving}>
                        Save settings
                    </Button>
                </Space>
            </Form>
        </div>
    )
}
