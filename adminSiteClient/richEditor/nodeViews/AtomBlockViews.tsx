import { useEffect, useRef, useState } from "react"
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import {
    EnrichedBlockAllCharts,
    EnrichedBlockChart,
    EnrichedBlockExplorerTiles,
    EnrichedBlockKeyInsights,
    EnrichedBlockNarrativeChart,
    EnrichedBlockPillRow,
    EnrichedBlockProminentLink,
    EnrichedBlockRecirc,
    EnrichedBlockResearchAndWriting,
    EnrichedBlockVideo,
    Span,
} from "@ourworldindata/types"
import { spansToUnformattedPlainText } from "@ourworldindata/utils"
import { GRAPHER_DYNAMIC_CONFIG_URL } from "../../../settings/clientSettings.js"
import { useEditingSessionGrapherState } from "../chartEditing/ChartEditingContext.js"
import { useNarrativeChartInfo } from "../chartEditing/useNarrativeChartInfo.js"
import { parseGrapherUrl } from "../grapherUrls.js"
import { BlockFrame } from "./BlockFrame.js"
import { LiveChartEmbed } from "./LiveChartEmbed.js"

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
    narrow?: boolean
    children?: React.ReactNode
}): React.ReactElement {
    const { nodeViewProps, blockType, summary, children } = props
    return (
        <NodeViewWrapper
            className={`rich-atom-block rich-atom-block--${blockType}${
                props.narrow ? " rich-atom-block--narrow" : ""
            }${nodeViewProps.selected ? " rich-block--selected" : ""}`}
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
    /** render immediately, e.g. while an editing session owns this block */
    forceVisible?: boolean
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
            {visible || props.forceVisible ? (
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
    const grapherUrl = parseGrapherUrl(url)
    const height = Number(chart.height) || CHART_FRAME_HEIGHT

    const liveGrapherState = useEditingSessionGrapherState({
        getPos: props.getPos,
        kind: "chart",
        identity: grapherUrl?.slug ?? "",
    })

    let contents: React.ReactNode
    if (grapherUrl) {
        contents = (
            <LazyVisible height={height} forceVisible={!!liveGrapherState}>
                <LiveChartEmbed
                    configUrl={`${GRAPHER_DYNAMIC_CONFIG_URL}/${grapherUrl.slug}.config.json${grapherUrl.queryStr}`}
                    queryKey={[
                        "richEditorGrapherConfig",
                        grapherUrl.slug,
                        grapherUrl.queryStr,
                    ]}
                    queryStr={grapherUrl.queryStr}
                    height={height}
                    liveGrapherState={liveGrapherState}
                />
            </LazyVisible>
        )
    } else if (/^https?:\/\//i.test(url)) {
        // a non-grapher absolute URL (e.g. an explorer) — iframe preview
        contents = (
            <LazyVisible height={height}>
                <iframe
                    className="rich-atom-block__chart-frame"
                    src={url}
                    title={url}
                    loading="lazy"
                    style={{ height }}
                />
            </LazyVisible>
        )
    } else if (url) {
        // never iframe a non-absolute URL: it would resolve inside the admin
        // and render an admin page into the block
        contents = (
            <div className="rich-atom-block__empty">
                Not a valid chart URL — pick a chart in the right rail
            </div>
        )
    } else {
        contents = (
            <div className="rich-atom-block__empty">
                Select this block to pick a chart in the right rail
            </div>
        )
    }

    return (
        <BlockChrome
            nodeViewProps={props}
            blockType="chart"
            summary={url.replace(/^https?:\/\/[^/]+/, "") || "no chart chosen"}
            narrow={chart.size === "narrow"}
        >
            {contents}
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
    const chart = getBlockProps(props) as unknown as Omit<
        EnrichedBlockNarrativeChart,
        "type"
    >
    const name = chart.name ?? ""
    const height = Number(chart.height) || CHART_FRAME_HEIGHT

    const { info, isLoading } = useNarrativeChartInfo(name)

    const liveGrapherState = useEditingSessionGrapherState({
        getPos: props.getPos,
        kind: "narrative-chart",
        identity: name,
    })

    return (
        <BlockChrome
            nodeViewProps={props}
            blockType="narrative-chart"
            summary={info ? `${name} — ${info.title}` : name || "no chart"}
            narrow={chart.size === "narrow"}
        >
            {info ? (
                <LazyVisible height={height} forceVisible={!!liveGrapherState}>
                    <LiveChartEmbed
                        // the narrative chart's own config already encodes
                        // tab/selection, so no query string is applied
                        configUrl={`${GRAPHER_DYNAMIC_CONFIG_URL}/by-uuid/${info.chartConfigId}.config.json`}
                        queryKey={[
                            "richEditorGrapherConfigByUuid",
                            info.chartConfigId,
                        ]}
                        height={height}
                        liveGrapherState={liveGrapherState}
                    />
                </LazyVisible>
            ) : (
                <div className="rich-atom-block__empty">
                    {isLoading
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

export function KeyInsightsBlockView(props: NodeViewProps): React.ReactElement {
    const block = getBlockProps(props) as unknown as Omit<
        EnrichedBlockKeyInsights,
        "type"
    >
    const slides = block.insights ?? []
    return (
        <BlockChrome
            nodeViewProps={props}
            blockType="key-insights"
            summary={block.heading ?? ""}
        >
            <div className="rich-atom-block__card">
                <strong>{block.heading || "Key insights"}</strong>
                <ol>
                    {slides.map((slide, index) => (
                        <li key={index}>{slide.title}</li>
                    ))}
                </ol>
            </div>
        </BlockChrome>
    )
}

export function ExplorerTilesBlockView(
    props: NodeViewProps
): React.ReactElement {
    const block = getBlockProps(props) as unknown as Omit<
        EnrichedBlockExplorerTiles,
        "type"
    >
    return (
        <BlockChrome
            nodeViewProps={props}
            blockType="explorer-tiles"
            summary={block.title ?? ""}
        >
            <div className="rich-atom-block__card">
                <strong>{block.title || "Explorer tiles"}</strong>
                {block.subtitle && <p>{block.subtitle}</p>}
                <ul>
                    {(block.explorers ?? []).map((explorer, index) => (
                        <li key={index}>{explorer.url}</li>
                    ))}
                </ul>
            </div>
        </BlockChrome>
    )
}

export function PillRowBlockView(props: NodeViewProps): React.ReactElement {
    const block = getBlockProps(props) as unknown as Omit<
        EnrichedBlockPillRow,
        "type"
    >
    return (
        <BlockChrome
            nodeViewProps={props}
            blockType="pill-row"
            summary={block.title ?? ""}
        >
            <div className="rich-atom-block__card">
                <strong>{block.title}</strong>
                <ul>
                    {(block.pills ?? []).map((pill, index) => (
                        <li key={index}>{pill.text || pill.url}</li>
                    ))}
                </ul>
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
