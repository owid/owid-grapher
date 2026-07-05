import { useEffect, useMemo, useState } from "react"
import { AutoComplete, Button, Input, Space, Typography } from "antd"
import {
    EnrichedBlockResearchAndWritingLink,
    EnrichedBlockText,
    EnrichedHybridLink,
    Span,
} from "@ourworldindata/types"
import { spansToUnformattedPlainText } from "@ourworldindata/utils"
import { ImageSelectorModal } from "../ImageSelectorModal.js"
import { parseGrapherUrl } from "./grapherUrls.js"
import { GRAPHER_URL_PREFIX, useChartList } from "./useChartList.js"

// The field primitives shared by the block inspector's typed sections
// (BlockInspector.tsx and inspectorSections.tsx).

export function ChartUrlField(props: {
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
export function ImageFilenameField(props: {
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
export function ListField<Item>(props: {
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
export function HybridLinksField(props: {
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
export function UrlListField(props: {
    value: { url: string }[]
    onChange: (items: { url: string }[]) => void
    addLabel?: string
}): React.ReactElement {
    return (
        <ListField<{ url: string }>
            items={props.value}
            onChange={props.onChange}
            makeNew={() => ({ url: "" })}
            addLabel={props.addLabel ?? "Add chart"}
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
export function RnwLinksField(props: {
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

export function isPlainTextSpans(spans: unknown): boolean {
    return (
        Array.isArray(spans) &&
        spans.every(
            (span) =>
                (span as Span).spanType === "span-simple-text" ||
                (span as Span).spanType === "span-newline"
        )
    )
}

// Plain-text bridge for nested EnrichedBlockText[]: some blocks carry text
// content inside their props (chart stories, key indicators, …). It is
// offered as a plain textarea (one paragraph per line) only while every
// span is plain, so formatting can never be silently destroyed; formatted
// content falls back to the JSON editor.

export function textBlocksArePlain(blocks: EnrichedBlockText[]): boolean {
    return blocks.every((block) => isPlainTextSpans(block.value))
}

export function textBlocksToPlainString(blocks: EnrichedBlockText[]): string {
    return blocks
        .map((block) => spansToUnformattedPlainText(block.value))
        .join("\n")
}

export function plainStringToTextBlocks(text: string): EnrichedBlockText[] {
    if (!text) return []
    return text.split("\n").map((line) => ({
        type: "text",
        value: line ? [{ spanType: "span-simple-text", text: line }] : [],
        parseErrors: [],
    }))
}

/** One-string-per-line textarea (e.g. tag lists, country lists) */
export function StringListTextArea(props: {
    value: string[]
    onChange: (items: string[]) => void
    placeholder?: string
}): React.ReactElement {
    // local text so typing a blank line mid-edit doesn't get eaten by the
    // parse → format round trip
    const [text, setText] = useState(props.value.join("\n"))
    useEffect(() => {
        setText(props.value.join("\n"))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.value.join("\n")])
    return (
        <Input.TextArea
            autoSize
            value={text}
            placeholder={props.placeholder ?? "One entry per line"}
            onChange={(event) => setText(event.target.value)}
            onBlur={() =>
                props.onChange(
                    text
                        .split("\n")
                        .map((line) => line.trim())
                        .filter(Boolean)
                )
            }
        />
    )
}
