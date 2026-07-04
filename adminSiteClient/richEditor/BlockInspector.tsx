import { useEffect, useMemo, useState } from "react"
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
import {
    EnrichedBlockResearchAndWritingLink,
    EnrichedHybridLink,
    Span,
} from "@ourworldindata/types"
import { spansToUnformattedPlainText } from "@ourworldindata/utils"
import { ImageSelectorModal } from "../ImageSelectorModal.js"
import { InspectedBlock } from "./inspection.js"
import { parseGrapherUrl } from "./grapherUrls.js"
import { GRAPHER_URL_PREFIX, useChartList } from "./useChartList.js"
import {
    ChartBlockActions,
    NarrativeChartBlockActions,
} from "./chartEditing/ChartBlockActions.js"

// The right-rail block inspector (stage A of the in-situ chart editing
// plan): opened by selecting a component in the canvas, it shows typed
// fields for the props of each block type, plus a raw-JSON editor covering
// everything else. Edits are applied as ProseMirror attribute updates, so
// undo/redo covers them.

function ChartUrlField(props: {
    value: string
    onChange: (url: string) => void
}): React.ReactElement {
    const charts = useChartList()
    // What the input currently shows. Typing must NOT write the block's url
    // (a half-typed search would break the chart in the canvas): the value is
    // only committed when an option is picked or a valid grapher URL is
    // pasted; anything else is reverted on blur.
    const [text, setText] = useState(props.value)

    useEffect(() => {
        setText(props.value)
        // re-sync when a different block is inspected or the url is changed
        // from elsewhere (e.g. the JSON editor)
    }, [props.value])

    const options = useMemo(() => {
        const raw = text.trim()
        if (!raw || raw === props.value) return []
        // pasted grapher URLs search by their slug
        const query = (parseGrapherUrl(raw)?.slug ?? raw).toLowerCase()
        return charts
            .filter((chart) => chart.isPublished && chart.slug)
            .filter(
                (chart) =>
                    chart.slug.toLowerCase().includes(query) ||
                    String(chart.id) === query
            )
            .slice(0, 20)
            .map((chart) => ({
                value: `${GRAPHER_URL_PREFIX}${chart.slug}`,
                label: `${chart.slug} — ${chart.title}`,
            }))
    }, [charts, text, props.value])

    const commitOrRevert = (): void => {
        const raw = text.trim()
        // allow clearing the block's chart explicitly
        if (raw === "") {
            if (props.value !== "") props.onChange("")
            return
        }
        if (raw !== props.value && parseGrapherUrl(raw)) {
            props.onChange(raw)
            return
        }
        setText(props.value)
    }

    return (
        <AutoComplete
            value={text}
            options={options}
            showSearch={{ onSearch: setText }}
            onSelect={(value) => {
                setText(String(value))
                props.onChange(String(value))
            }}
            onBlur={commitOrRevert}
            placeholder="Search by chart slug or id, or paste a grapher URL"
        />
    )
}

/** Image filename with a Replace… button opening the image library */
function ImageFilenameField(props: {
    value: string
    onChange: (filename: string | undefined) => void
    allowClear?: boolean
}): React.ReactElement {
    const [selectorOpen, setSelectorOpen] = useState(false)
    return (
        <Space orientation="vertical" style={{ width: "100%" }}>
            {props.value ? (
                <Typography.Text
                    ellipsis={{ tooltip: props.value }}
                    style={{ maxWidth: 260 }}
                >
                    {props.value}
                </Typography.Text>
            ) : null}
            <Space>
                <Button size="small" onClick={() => setSelectorOpen(true)}>
                    {props.value ? "Replace…" : "Choose…"}
                </Button>
                {props.allowClear && props.value && (
                    <Button
                        size="small"
                        onClick={() => props.onChange(undefined)}
                    >
                        Clear
                    </Button>
                )}
            </Space>
            <ImageSelectorModal
                open={selectorOpen}
                onSelect={(filename) => {
                    props.onChange(filename)
                    setSelectorOpen(false)
                }}
                onCancel={() => setSelectorOpen(false)}
            />
        </Space>
    )
}

/**
 * Generic ordered-list editor: each item is rendered by the caller; the
 * chrome adds move up/down, remove, and an add button.
 */
function ListField<Item>(props: {
    items: Item[]
    onChange: (items: Item[]) => void
    makeNew: () => Item
    addLabel: string
    renderItem: (item: Item, update: (item: Item) => void) => React.ReactNode
}): React.ReactElement {
    const { items, onChange, makeNew, addLabel, renderItem } = props
    const move = (index: number, delta: number): void => {
        const target = index + delta
        if (target < 0 || target >= items.length) return
        const next = [...items]
        ;[next[index], next[target]] = [next[target], next[index]]
        onChange(next)
    }
    return (
        <div className="rich-editor-inspector__list">
            {items.map((item, index) => (
                <div key={index} className="rich-editor-inspector__list-item">
                    <div className="rich-editor-inspector__list-fields">
                        {renderItem(item, (updated) => {
                            const next = [...items]
                            next[index] = updated
                            onChange(next)
                        })}
                    </div>
                    <div className="rich-editor-inspector__list-controls">
                        <Button
                            size="small"
                            type="text"
                            disabled={index === 0}
                            onClick={() => move(index, -1)}
                        >
                            ↑
                        </Button>
                        <Button
                            size="small"
                            type="text"
                            disabled={index === items.length - 1}
                            onClick={() => move(index, 1)}
                        >
                            ↓
                        </Button>
                        <Button
                            size="small"
                            type="text"
                            danger
                            onClick={() =>
                                onChange(items.filter((_, i) => i !== index))
                            }
                        >
                            ✕
                        </Button>
                    </div>
                </div>
            ))}
            <Button
                size="small"
                onClick={() => onChange([...items, makeNew()])}
            >
                + {addLabel}
            </Button>
        </div>
    )
}

/** Recirc-style links: gdoc/grapher/external URL with optional overrides */
function HybridLinksField(props: {
    value: EnrichedHybridLink[]
    onChange: (links: EnrichedHybridLink[]) => void
}): React.ReactElement {
    return (
        <ListField<EnrichedHybridLink>
            items={props.value}
            onChange={props.onChange}
            makeNew={() => ({ type: "hybrid-link", url: "" })}
            addLabel="Add link"
            renderItem={(link, update) => (
                <>
                    <Input
                        size="small"
                        placeholder="URL (gdoc, grapher or external)"
                        value={link.url}
                        onChange={(event) =>
                            update({ ...link, url: event.target.value })
                        }
                    />
                    <Input
                        size="small"
                        placeholder="Title override (optional)"
                        value={link.title ?? ""}
                        onChange={(event) =>
                            update({
                                ...link,
                                title: event.target.value || undefined,
                            })
                        }
                    />
                    <Input
                        size="small"
                        placeholder="Subtitle override (optional)"
                        value={link.subtitle ?? ""}
                        onChange={(event) =>
                            update({
                                ...link,
                                subtitle: event.target.value || undefined,
                            })
                        }
                    />
                </>
            )}
        />
    )
}

/** Plain URL list, e.g. the pinned charts of an all-charts block */
function UrlListField(props: {
    value: { url: string }[]
    onChange: (items: { url: string }[]) => void
}): React.ReactElement {
    return (
        <ListField<{ url: string }>
            items={props.value}
            onChange={props.onChange}
            makeNew={() => ({ url: "" })}
            addLabel="Add chart"
            renderItem={(item, update) => (
                <Input
                    size="small"
                    placeholder="Grapher or explorer URL"
                    value={item.url}
                    onChange={(event) => update({ url: event.target.value })}
                />
            )}
        />
    )
}

/** Research & writing links ({value: {url, title?, subtitle?}}) */
function RnwLinksField(props: {
    value: EnrichedBlockResearchAndWritingLink[]
    onChange: (links: EnrichedBlockResearchAndWritingLink[]) => void
}): React.ReactElement {
    return (
        <ListField<EnrichedBlockResearchAndWritingLink>
            items={props.value}
            onChange={props.onChange}
            makeNew={() => ({ value: { url: "" } })}
            addLabel="Add link"
            renderItem={(link, update) => (
                <>
                    <Input
                        size="small"
                        placeholder="URL (gdoc or external)"
                        value={link.value.url}
                        onChange={(event) =>
                            update({
                                value: {
                                    ...link.value,
                                    url: event.target.value,
                                },
                            })
                        }
                    />
                    <Input
                        size="small"
                        placeholder="Title override (optional)"
                        value={link.value.title ?? ""}
                        onChange={(event) =>
                            update({
                                value: {
                                    ...link.value,
                                    title: event.target.value || undefined,
                                },
                            })
                        }
                    />
                </>
            )}
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

    const deleteButton = (
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
    )

    const header = (
        <div className="rich-editor-comments__thread-header">
            <Typography.Title level={5} style={{ margin: 0 }}>
                Block: {inspected.blockType}
            </Typography.Title>
            <Button size="small" type="text" onClick={onClose}>
                ✕
            </Button>
        </div>
    )

    if (inspected.kind === "container") {
        return (
            <div className="rich-editor-rail__panel">
                {header}
                <Typography.Paragraph type="secondary">
                    This layout component has no settings of its own — its
                    contents are edited directly in the canvas. Drag its border
                    to move it, or delete it below (its contents are deleted
                    with it).
                </Typography.Paragraph>
                {deleteButton}
            </div>
        )
    }

    if (inspected.kind === "raw") {
        return (
            <div className="rich-editor-rail__panel">
                {header}
                <Alert
                    type="warning"
                    title="Not editable here yet"
                    description="This block type is carried through saves untouched. It can be moved and deleted, but not edited."
                    style={{ marginBottom: 8 }}
                />
                <Input.TextArea
                    className="rich-editor-inspector__json"
                    autoSize={{ minRows: 6, maxRows: 24 }}
                    value={jsonText}
                    readOnly
                />
                {deleteButton}
            </div>
        )
    }

    const captionEditable =
        draft.caption === undefined ||
        draft.caption === null ||
        isPlainTextSpans(draft.caption)

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
                        <ChartBlockActions
                            inspected={inspected}
                            chartUrl={String(draft.url ?? "")}
                        />
                    </>
                )
            case "narrative-chart":
                return (
                    <>
                        <Form.Item label="Narrative chart name">
                            <Input
                                value={String(draft.name ?? "")}
                                onChange={(event) =>
                                    apply({ name: event.target.value })
                                }
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
                        <NarrativeChartBlockActions
                            inspected={inspected}
                            name={String(draft.name ?? "")}
                        />
                    </>
                )
            case "image":
                return (
                    <>
                        <Form.Item label="Image">
                            <ImageFilenameField
                                value={String(draft.filename ?? "")}
                                onChange={(filename) =>
                                    apply({ filename: filename ?? "" })
                                }
                            />
                        </Form.Item>
                        <Form.Item label="Mobile image (optional)">
                            <ImageFilenameField
                                value={String(draft.smallFilename ?? "")}
                                onChange={(smallFilename) =>
                                    apply({ smallFilename })
                                }
                                allowClear
                            />
                        </Form.Item>
                        <Form.Item label="Alt text (optional override)">
                            <Input.TextArea
                                autoSize
                                value={String(draft.alt ?? "")}
                                onChange={(event) =>
                                    apply({ alt: event.target.value })
                                }
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
                        <Checkbox
                            checked={Boolean(draft.hasOutline)}
                            onChange={(event) =>
                                apply({ hasOutline: event.target.checked })
                            }
                        >
                            Outline
                        </Checkbox>
                    </>
                )
            case "cta":
                return (
                    <>
                        <Form.Item label="Button text">
                            <Input
                                value={String(draft.text ?? "")}
                                onChange={(event) =>
                                    apply({ text: event.target.value })
                                }
                            />
                        </Form.Item>
                        <Form.Item label="URL">
                            <Input
                                value={String(draft.url ?? "")}
                                placeholder="https://ourworldindata.org/…"
                                onChange={(event) =>
                                    apply({ url: event.target.value })
                                }
                            />
                        </Form.Item>
                    </>
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
                        <Form.Item label="Thumbnail filename (optional)">
                            <Input
                                value={String(draft.thumbnail ?? "")}
                                onChange={(event) =>
                                    apply({ thumbnail: event.target.value })
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
                                    { value: "left-center" },
                                    { value: "right-center" },
                                    { value: "right" },
                                ]}
                            />
                        </Form.Item>
                    </>
                )
            case "recirc":
                return (
                    <>
                        <Form.Item label="Title">
                            <Input
                                value={String(draft.title ?? "")}
                                onChange={(event) =>
                                    apply({ title: event.target.value })
                                }
                            />
                        </Form.Item>
                        <Form.Item label="Alignment">
                            <Select
                                allowClear
                                placeholder="default"
                                value={(draft.align ?? undefined) as string}
                                onChange={(align) => apply({ align })}
                                options={[
                                    { value: "left" },
                                    { value: "center" },
                                    { value: "right" },
                                ]}
                            />
                        </Form.Item>
                        <Form.Item label="Links">
                            <HybridLinksField
                                value={
                                    (draft.links ?? []) as EnrichedHybridLink[]
                                }
                                onChange={(links) => apply({ links })}
                            />
                        </Form.Item>
                    </>
                )
            case "all-charts":
                return (
                    <>
                        <Form.Item label="Heading">
                            <Input
                                value={String(draft.heading ?? "")}
                                onChange={(event) =>
                                    apply({ heading: event.target.value })
                                }
                            />
                        </Form.Item>
                        <Form.Item label="Pinned charts (top)">
                            <UrlListField
                                value={(draft.top ?? []) as { url: string }[]}
                                onChange={(top) => apply({ top })}
                            />
                        </Form.Item>
                    </>
                )
            case "key-insights":
                return (
                    <>
                        <Form.Item label="Heading">
                            <Input
                                value={String(draft.heading ?? "")}
                                onChange={(event) =>
                                    apply({ heading: event.target.value })
                                }
                            />
                        </Form.Item>
                        <p className="rich-editor-inspector__hint">
                            Slides (title, chart/image, content blocks) are
                            edited via Advanced (JSON) below for now.
                        </p>
                    </>
                )
            case "explorer-tiles":
                return (
                    <>
                        <Form.Item label="Title">
                            <Input
                                value={String(draft.title ?? "")}
                                onChange={(event) =>
                                    apply({ title: event.target.value })
                                }
                            />
                        </Form.Item>
                        <Form.Item label="Subtitle">
                            <Input
                                value={String(draft.subtitle ?? "")}
                                onChange={(event) =>
                                    apply({ subtitle: event.target.value })
                                }
                            />
                        </Form.Item>
                        <Form.Item label="Explorers">
                            <UrlListField
                                value={
                                    (draft.explorers ?? []) as {
                                        url: string
                                    }[]
                                }
                                onChange={(explorers) => apply({ explorers })}
                            />
                        </Form.Item>
                    </>
                )
            case "pill-row":
                return (
                    <>
                        <Form.Item label="Title">
                            <Input
                                value={String(draft.title ?? "")}
                                onChange={(event) =>
                                    apply({ title: event.target.value })
                                }
                            />
                        </Form.Item>
                        <p className="rich-editor-inspector__hint">
                            Pills (text + url) are edited via Advanced (JSON)
                            below for now.
                        </p>
                    </>
                )
            case "research-and-writing":
                return (
                    <>
                        <Form.Item label="Heading (optional)">
                            <Input
                                value={String(draft.heading ?? "")}
                                onChange={(event) =>
                                    apply({ heading: event.target.value })
                                }
                            />
                        </Form.Item>
                        <Space style={{ marginBottom: 12 }}>
                            <Checkbox
                                checked={Boolean(draft["hide-authors"])}
                                onChange={(event) =>
                                    apply({
                                        "hide-authors": event.target.checked,
                                    })
                                }
                            >
                                Hide authors
                            </Checkbox>
                            <Checkbox
                                checked={Boolean(draft["hide-date"])}
                                onChange={(event) =>
                                    apply({
                                        "hide-date": event.target.checked,
                                    })
                                }
                            >
                                Hide date
                            </Checkbox>
                        </Space>
                        <Form.Item label="Variant">
                            <Select
                                allowClear
                                placeholder="default"
                                value={(draft.variant ?? undefined) as string}
                                onChange={(variant) => apply({ variant })}
                                options={[{ value: "featured" }]}
                            />
                        </Form.Item>
                        <Form.Item label="Primary links">
                            <RnwLinksField
                                value={
                                    (draft.primary ??
                                        []) as EnrichedBlockResearchAndWritingLink[]
                                }
                                onChange={(primary) => apply({ primary })}
                            />
                        </Form.Item>
                        <Form.Item label="Secondary links">
                            <RnwLinksField
                                value={
                                    (draft.secondary ??
                                        []) as EnrichedBlockResearchAndWritingLink[]
                                }
                                onChange={(secondary) => apply({ secondary })}
                            />
                        </Form.Item>
                        <Typography.Paragraph type="secondary">
                            Row sections and the “more” list are edited via
                            Advanced (JSON) below for now.
                        </Typography.Paragraph>
                    </>
                )
            case "table":
                return (
                    <>
                        <Form.Item label="Template">
                            <Select
                                value={String(draft.template ?? "header-row")}
                                onChange={(template) => apply({ template })}
                                options={[
                                    { value: "header-row" },
                                    { value: "header-column" },
                                    { value: "header-column-row" },
                                ]}
                            />
                        </Form.Item>
                        <Form.Item label="Size">
                            <Select
                                value={String(draft.size ?? "narrow")}
                                onChange={(size) => apply({ size })}
                                options={[
                                    { value: "narrow" },
                                    { value: "wide" },
                                ]}
                            />
                        </Form.Item>
                        {inspected.tableCommands && (
                            <Form.Item label="Rows & columns">
                                <Space wrap>
                                    <Button
                                        size="small"
                                        onClick={inspected.tableCommands.addRow}
                                    >
                                        + Row
                                    </Button>
                                    <Button
                                        size="small"
                                        onClick={
                                            inspected.tableCommands.removeRow
                                        }
                                    >
                                        − Row
                                    </Button>
                                    <Button
                                        size="small"
                                        onClick={
                                            inspected.tableCommands.addColumn
                                        }
                                    >
                                        + Column
                                    </Button>
                                    <Button
                                        size="small"
                                        onClick={
                                            inspected.tableCommands.removeColumn
                                        }
                                    >
                                        − Column
                                    </Button>
                                </Space>
                            </Form.Item>
                        )}
                    </>
                )
            case "aside":
                return (
                    <Form.Item label="Position">
                        <Select
                            allowClear
                            placeholder="default"
                            value={(draft.position ?? undefined) as string}
                            onChange={(position) => apply({ position })}
                            options={[{ value: "left" }, { value: "right" }]}
                        />
                    </Form.Item>
                )
            case "blockquote":
                return (
                    <Form.Item label="Citation (optional)">
                        <Input
                            value={String(draft.citation ?? "")}
                            onChange={(event) =>
                                apply({ citation: event.target.value })
                            }
                        />
                    </Form.Item>
                )
            case "callout":
                return (
                    <>
                        <Form.Item label="Title (optional)">
                            <Input
                                value={String(draft.title ?? "")}
                                onChange={(event) =>
                                    apply({ title: event.target.value })
                                }
                            />
                        </Form.Item>
                        <Checkbox
                            checked={draft.icon === "info"}
                            onChange={(event) =>
                                apply({
                                    icon: event.target.checked
                                        ? "info"
                                        : undefined,
                                })
                            }
                        >
                            Show info icon
                        </Checkbox>
                    </>
                )
            default:
                return null
        }
    })()

    const showCaptionField =
        ["chart", "narrative-chart", "video", "image", "table"].includes(
            inspected.blockType
        ) && captionEditable

    return (
        <div className="rich-editor-rail__panel">
            {header}
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
                {deleteButton}
            </Form>
        </div>
    )
}
