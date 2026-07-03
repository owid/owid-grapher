import { useContext, useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import {
    EnrichedBlockAllCharts,
    EnrichedBlockChart,
    EnrichedBlockNarrativeChart,
    EnrichedBlockProminentLink,
    EnrichedBlockRecirc,
    EnrichedBlockResearchAndWriting,
    EnrichedBlockVideo,
    Span,
} from "@ourworldindata/types"
import { spansToUnformattedPlainText } from "@ourworldindata/utils"
import { RichEditorResolveReferencesResponse } from "../../../adminShared/RichEditorTypes.js"
import { AdminAppContext } from "../../AdminAppContext.js"
import { BlockFrame } from "./BlockFrame.js"

// NodeViews for the atom blocks whose `props` attr carries the enriched
// block verbatim. They render a preview with a shared BlockFrame chrome:
// hovering the block's border shows a thin frame that selects on click
// (opening the block's settings in the right rail) and drags to reorder.

function getBlockProps(props: NodeViewProps): Record<string, unknown> {
    return (props.node.attrs.props ?? {}) as Record<string, unknown>
}

function BlockChrome(props: {
    nodeViewProps: NodeViewProps
    blockType: string
    summary: string
    children?: React.ReactNode
}): React.ReactElement {
    const { nodeViewProps, blockType, summary, children } = props
    return (
        <NodeViewWrapper
            className={`rich-atom-block rich-atom-block--${blockType}${
                nodeViewProps.selected ? " rich-block--selected" : ""
            }`}
        >
            <BlockFrame
                nodeViewProps={nodeViewProps}
                label={blockType}
                summary={summary}
            />
            <div contentEditable={false}>{children}</div>
        </NodeViewWrapper>
    )
}

/** Renders its children only once the wrapper has scrolled near the viewport */
function LazyVisible(props: {
    height: number
    children: React.ReactNode
}): React.ReactElement {
    const ref = useRef<HTMLDivElement | null>(null)
    const [visible, setVisible] = useState(false)
    useEffect(() => {
        const element = ref.current
        if (!element || visible) return undefined
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setVisible(true)
                    observer.disconnect()
                }
            },
            { rootMargin: "400px" }
        )
        observer.observe(element)
        return () => observer.disconnect()
    }, [visible])
    return (
        <div ref={ref} style={{ minHeight: props.height }}>
            {visible ? (
                props.children
            ) : (
                <div
                    className="rich-atom-block__placeholder"
                    style={{ height: props.height }}
                >
                    Chart loads when scrolled into view…
                </div>
            )}
        </div>
    )
}

const CHART_FRAME_HEIGHT = 600

function captionText(caption: Span[] | undefined): string {
    return caption ? spansToUnformattedPlainText(caption) : ""
}

export function ChartBlockView(props: NodeViewProps): React.ReactElement {
    const chart = getBlockProps(props) as unknown as Omit<
        EnrichedBlockChart,
        "type"
    >
    const url = chart.url ?? ""
    return (
        <BlockChrome
            nodeViewProps={props}
            blockType="chart"
            summary={url.replace(/^https?:\/\/[^/]+/, "") || "no chart chosen"}
        >
            {url ? (
                <LazyVisible height={CHART_FRAME_HEIGHT}>
                    <iframe
                        className="rich-atom-block__chart-frame"
                        src={url}
                        title={url}
                        loading="lazy"
                        style={{
                            height: Number(chart.height) || CHART_FRAME_HEIGHT,
                        }}
                    />
                </LazyVisible>
            ) : (
                <div className="rich-atom-block__empty">
                    Select this block to pick a chart in the right rail
                </div>
            )}
            {chart.caption && (
                <figcaption className="rich-atom-block__caption">
                    {captionText(chart.caption)}
                </figcaption>
            )}
        </BlockChrome>
    )
}

export function NarrativeChartBlockView(
    props: NodeViewProps
): React.ReactElement {
    const { admin } = useContext(AdminAppContext)
    const chart = getBlockProps(props) as unknown as Omit<
        EnrichedBlockNarrativeChart,
        "type"
    >
    const name = chart.name ?? ""

    const infoQuery = useQuery({
        queryKey: ["richEditorNarrativeChart", name],
        queryFn: async () => {
            const response = (await admin.requestJSON(
                "/api/editor/resolveReferences",
                { narrativeChartNames: [name] },
                "POST"
            )) as unknown as RichEditorResolveReferencesResponse
            return response.narrativeCharts[name] ?? null
        },
        enabled: !!name,
        staleTime: Infinity,
    })
    const info = infoQuery.data

    let frameUrl: string | undefined
    if (info) {
        const params = new URLSearchParams(
            info.queryParamsForParentChart as Record<string, string>
        )
        frameUrl = `https://ourworldindata.org/grapher/${info.parentChartSlug}?${params.toString()}`
    }

    return (
        <BlockChrome
            nodeViewProps={props}
            blockType="narrative-chart"
            summary={info ? `${name} — ${info.title}` : name || "no chart"}
        >
            {frameUrl ? (
                <LazyVisible height={CHART_FRAME_HEIGHT}>
                    <iframe
                        className="rich-atom-block__chart-frame"
                        src={frameUrl}
                        title={name}
                        loading="lazy"
                        style={{
                            height: Number(chart.height) || CHART_FRAME_HEIGHT,
                        }}
                    />
                </LazyVisible>
            ) : (
                <div className="rich-atom-block__empty">
                    {infoQuery.isLoading
                        ? "Resolving narrative chart…"
                        : `Narrative chart "${name}" not found`}
                </div>
            )}
            {chart.caption && (
                <figcaption className="rich-atom-block__caption">
                    {captionText(chart.caption)}
                </figcaption>
            )}
        </BlockChrome>
    )
}

export function VideoBlockView(props: NodeViewProps): React.ReactElement {
    const video = getBlockProps(props) as unknown as Omit<
        EnrichedBlockVideo,
        "type"
    >
    return (
        <BlockChrome
            nodeViewProps={props}
            blockType="video"
            summary={video.filename || video.url || ""}
        >
            {video.url ? (
                <video
                    className="rich-atom-block__video"
                    src={video.url}
                    controls
                    loop={video.shouldLoop}
                    muted
                />
            ) : (
                <div className="rich-atom-block__empty">No video URL set</div>
            )}
            {video.caption && (
                <figcaption className="rich-atom-block__caption">
                    {captionText(video.caption)}
                </figcaption>
            )}
        </BlockChrome>
    )
}

export function ProminentLinkBlockView(
    props: NodeViewProps
): React.ReactElement {
    const link = getBlockProps(props) as unknown as Omit<
        EnrichedBlockProminentLink,
        "type"
    >
    return (
        <BlockChrome
            nodeViewProps={props}
            blockType="prominent-link"
            summary={link.url ?? ""}
        >
            <div className="rich-atom-block__card">
                <strong>{link.title || link.url}</strong>
                {link.description && <p>{link.description}</p>}
            </div>
        </BlockChrome>
    )
}

export function RecircBlockView(props: NodeViewProps): React.ReactElement {
    const recirc = getBlockProps(props) as unknown as Omit<
        EnrichedBlockRecirc,
        "type"
    >
    return (
        <BlockChrome
            nodeViewProps={props}
            blockType="recirc"
            summary={recirc.title ?? ""}
        >
            <div className="rich-atom-block__card">
                <strong>{recirc.title}</strong>
                <ul>
                    {(recirc.links ?? []).map((link, index) => (
                        <li key={index}>{link.title || link.url}</li>
                    ))}
                </ul>
            </div>
        </BlockChrome>
    )
}

export function ResearchAndWritingBlockView(
    props: NodeViewProps
): React.ReactElement {
    const block = getBlockProps(props) as unknown as Omit<
        EnrichedBlockResearchAndWriting,
        "type"
    >
    const rowCount = block.rows?.length ?? 0
    return (
        <BlockChrome
            nodeViewProps={props}
            blockType="research-and-writing"
            summary={`${block.primary?.length ?? 0} primary · ${rowCount} rows`}
        >
            <div className="rich-atom-block__card">
                Research &amp; Writing section (rendered on the site; edited in
                the right rail)
            </div>
        </BlockChrome>
    )
}

export function AllChartsBlockView(props: NodeViewProps): React.ReactElement {
    const block = getBlockProps(props) as unknown as Omit<
        EnrichedBlockAllCharts,
        "type"
    >
    return (
        <BlockChrome
            nodeViewProps={props}
            blockType="all-charts"
            summary={block.heading ?? ""}
        >
            <div className="rich-atom-block__card">
                All charts for this topic ({(block.top ?? []).length} pinned)
            </div>
        </BlockChrome>
    )
}
