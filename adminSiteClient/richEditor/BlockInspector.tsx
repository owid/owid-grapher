import { useContext, useEffect, useMemo, useState } from "react"
import {
    Alert,
    AutoComplete,
    Button,
    Checkbox,
    Collapse,
    Form,
    Input,
    Popconfirm,
    Select,
    Space,
    Typography,
} from "antd"
import { useQuery } from "@tanstack/react-query"
import { Span } from "@ourworldindata/types"
import { spansToUnformattedPlainText } from "@ourworldindata/utils"
import { AdminAppContext } from "../AdminAppContext.js"
import { InspectedBlock } from "./uiContext.js"

// The right-rail block inspector ("cogwheel", stage A of the in-situ chart
// editing plan): typed fields for the common props of each atom block, plus
// a raw-JSON editor covering everything else. Edits are applied as
// ProseMirror attribute updates, so undo/redo covers them.

const GRAPHER_URL_PREFIX = "https://ourworldindata.org/grapher/"

interface ChartListItem {
    id: number
    title: string
    slug: string
    isPublished: boolean
}

function useChartList(): ChartListItem[] {
    const { admin } = useContext(AdminAppContext)
    const chartsQuery = useQuery({
        queryKey: ["richEditorChartList"],
        // fail-soft: without the chart list the field still accepts pasted
        // grapher URLs, so a failing list endpoint must not break the editor
        queryFn: async () => {
            const response = await admin.rawRequest(
                "/api/charts.json",
                undefined,
                "GET"
            )
            if (!response.ok) return { charts: [] }
            return (await response.json()) as { charts: ChartListItem[] }
        },
        staleTime: Infinity,
        retry: false,
    })
    return chartsQuery.data?.charts ?? []
}

function ChartUrlField(props: {
    value: string
    onChange: (url: string) => void
}): React.ReactElement {
    const charts = useChartList()
    const [search, setSearch] = useState("")
    const options = useMemo(() => {
        const query = search.trim().toLowerCase()
        if (!query) return []
        return charts
            .filter((chart) => chart.isPublished && chart.slug)
            .filter(
                (chart) =>
                    chart.title?.toLowerCase().includes(query) ||
                    chart.slug?.toLowerCase().includes(query)
            )
            .slice(0, 20)
            .map((chart) => ({
                value: `${GRAPHER_URL_PREFIX}${chart.slug}`,
                label: `${chart.title} (${chart.slug})`,
            }))
    }, [charts, search])

    return (
        <AutoComplete
            value={props.value}
            options={options}
            showSearch={{ onSearch: setSearch }}
            onChange={(value) => props.onChange(String(value))}
            placeholder="Search published charts or paste a grapher URL"
        />
    )
}

function isPlainTextSpans(spans: unknown): boolean {
    return (
        Array.isArray(spans) &&
        spans.every(
            (span) =>
                (span as Span).spanType === "span-simple-text" ||
                (span as Span).spanType === "span-newline"
        )
    )
}

export function BlockInspector(props: {
    inspected: InspectedBlock
    onClose: () => void
}): React.ReactElement {
    const { inspected, onClose } = props
    // local working copy of the props; applied immediately on field changes
    const [draft, setDraft] = useState<Record<string, unknown>>(inspected.props)
    const [jsonText, setJsonText] = useState(() =>
        JSON.stringify(inspected.props, null, 2)
    )
    const [jsonError, setJsonError] = useState<string | null>(null)

    useEffect(() => {
        setDraft(inspected.props)
        setJsonText(JSON.stringify(inspected.props, null, 2))
        setJsonError(null)
        // re-sync when a different block is inspected
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inspected])

    const apply = (updates: Record<string, unknown>): void => {
        const next = { ...draft, ...updates }
        for (const [key, value] of Object.entries(updates)) {
            if (value === undefined || value === "" || value === null) {
                delete next[key]
            }
        }
        setDraft(next)
        setJsonText(JSON.stringify(next, null, 2))
        inspected.updateProps(next)
    }

    const captionEditable =
        draft.caption === undefined || isPlainTextSpans(draft.caption)

    const typedFields = ((): React.ReactNode => {
        switch (inspected.blockType) {
            case "chart":
                return (
                    <>
                        <Form.Item label="Chart">
                            <ChartUrlField
                                value={String(draft.url ?? "")}
                                onChange={(url) => apply({ url })}
                            />
                        </Form.Item>
                        <Form.Item label="Size">
                            <Select
                                value={String(draft.size ?? "wide")}
                                onChange={(size) => apply({ size })}
                                options={[
                                    { value: "narrow" },
                                    { value: "wide" },
                                ]}
                            />
                        </Form.Item>
                        <Form.Item label="Height (px, optional)">
                            <Input
                                value={String(draft.height ?? "")}
                                onChange={(event) =>
                                    apply({ height: event.target.value })
                                }
                            />
                        </Form.Item>
                    </>
                )
            case "narrative-chart":
                return (
                    <Form.Item label="Narrative chart name">
                        <Input
                            value={String(draft.name ?? "")}
                            onChange={(event) =>
                                apply({ name: event.target.value })
                            }
                        />
                    </Form.Item>
                )
            case "video":
                return (
                    <>
                        <Form.Item label="Video URL">
                            <Input
                                value={String(draft.url ?? "")}
                                onChange={(event) =>
                                    apply({ url: event.target.value })
                                }
                            />
                        </Form.Item>
                        <Form.Item label="Poster filename">
                            <Input
                                value={String(draft.filename ?? "")}
                                onChange={(event) =>
                                    apply({ filename: event.target.value })
                                }
                            />
                        </Form.Item>
                        <Space>
                            <Checkbox
                                checked={Boolean(draft.shouldLoop)}
                                onChange={(event) =>
                                    apply({
                                        shouldLoop: event.target.checked,
                                    })
                                }
                            >
                                Loop
                            </Checkbox>
                            <Checkbox
                                checked={Boolean(draft.shouldAutoplay)}
                                onChange={(event) =>
                                    apply({
                                        shouldAutoplay: event.target.checked,
                                    })
                                }
                            >
                                Autoplay
                            </Checkbox>
                        </Space>
                    </>
                )
            case "prominent-link":
                return (
                    <>
                        <Form.Item label="URL">
                            <Input
                                value={String(draft.url ?? "")}
                                onChange={(event) =>
                                    apply({ url: event.target.value })
                                }
                            />
                        </Form.Item>
                        <Form.Item label="Title (optional override)">
                            <Input
                                value={String(draft.title ?? "")}
                                onChange={(event) =>
                                    apply({ title: event.target.value })
                                }
                            />
                        </Form.Item>
                        <Form.Item label="Description">
                            <Input.TextArea
                                autoSize
                                value={String(draft.description ?? "")}
                                onChange={(event) =>
                                    apply({
                                        description: event.target.value,
                                    })
                                }
                            />
                        </Form.Item>
                    </>
                )
            case "pull-quote":
                return (
                    <>
                        <Form.Item label="Quote">
                            <Input.TextArea
                                autoSize
                                value={String(draft.quote ?? "")}
                                onChange={(event) =>
                                    apply({ quote: event.target.value })
                                }
                            />
                        </Form.Item>
                        <Form.Item label="Alignment">
                            <Select
                                value={String(draft.align ?? "left")}
                                onChange={(align) => apply({ align })}
                                options={[
                                    { value: "left" },
                                    { value: "right" },
                                ]}
                            />
                        </Form.Item>
                    </>
                )
            case "recirc":
                return (
                    <Form.Item label="Title">
                        <Input
                            value={String(draft.title ?? "")}
                            onChange={(event) =>
                                apply({ title: event.target.value })
                            }
                        />
                    </Form.Item>
                )
            default:
                return null
        }
    })()

    const showCaptionField =
        ["chart", "narrative-chart", "video"].includes(inspected.blockType) &&
        captionEditable

    return (
        <div className="rich-editor-rail__panel">
            <div className="rich-editor-comments__thread-header">
                <Typography.Title level={5} style={{ margin: 0 }}>
                    Block: {inspected.blockType}
                </Typography.Title>
                <Button size="small" type="text" onClick={onClose}>
                    ✕
                </Button>
            </div>
            <Form layout="vertical" size="small">
                {typedFields}
                {showCaptionField && (
                    <Form.Item label="Caption">
                        <Input.TextArea
                            autoSize
                            value={spansToUnformattedPlainText(
                                (draft.caption as Span[]) ?? []
                            )}
                            onChange={(event) =>
                                apply({
                                    caption: event.target.value
                                        ? [
                                              {
                                                  spanType: "span-simple-text",
                                                  text: event.target.value,
                                              },
                                          ]
                                        : undefined,
                                })
                            }
                        />
                    </Form.Item>
                )}
                <Collapse
                    ghost
                    size="small"
                    items={[
                        {
                            key: "json",
                            label: "Advanced (JSON)",
                            children: (
                                <>
                                    {jsonError && (
                                        <Alert
                                            type="error"
                                            title={jsonError}
                                            style={{ marginBottom: 8 }}
                                        />
                                    )}
                                    <Input.TextArea
                                        className="rich-editor-inspector__json"
                                        autoSize={{ minRows: 6, maxRows: 24 }}
                                        value={jsonText}
                                        onChange={(event) =>
                                            setJsonText(event.target.value)
                                        }
                                    />
                                    <Button
                                        size="small"
                                        style={{ marginTop: 8 }}
                                        onClick={() => {
                                            try {
                                                const parsed =
                                                    JSON.parse(jsonText)
                                                setJsonError(null)
                                                setDraft(parsed)
                                                inspected.updateProps(parsed)
                                            } catch (error) {
                                                setJsonError(String(error))
                                            }
                                        }}
                                    >
                                        Apply JSON
                                    </Button>
                                </>
                            ),
                        },
                    ]}
                />
                <Popconfirm
                    title="Delete this block?"
                    onConfirm={() => {
                        inspected.deleteBlock()
                        onClose()
                    }}
                >
                    <Button danger size="small" style={{ marginTop: 12 }}>
                        Delete block
                    </Button>
                </Popconfirm>
            </Form>
        </div>
    )
}
