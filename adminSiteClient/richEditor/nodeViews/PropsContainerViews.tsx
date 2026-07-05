import { NodeViewContent, NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import { BlockFrame } from "./BlockFrame.js"

// NodeViews for the props containers: editable containers whose non-content
// fields travel in a `props` attr (edited in the right rail) while their
// content is a real editable hole in the canvas. Shaped like the other
// container views — BlockFrame chrome for select/drag/delete plus an
// optional non-editable header rendered from the props.

function getContainerProps(props: NodeViewProps): Record<string, unknown> {
    return (props.node.attrs.props ?? {}) as Record<string, unknown>
}

function PropsContainerChrome(viewProps: {
    nodeViewProps: NodeViewProps
    blockType: string
    summary?: string
    header?: React.ReactNode
    contentClassName?: string
}): React.ReactElement {
    const { nodeViewProps, blockType, summary, header, contentClassName } =
        viewProps
    return (
        <NodeViewWrapper
            className={`rich-container-block rich-props-container rich-props-container--${blockType}${
                nodeViewProps.selected ? " rich-block--selected" : ""
            }`}
        >
            <BlockFrame
                nodeViewProps={nodeViewProps}
                label={blockType}
                summary={summary}
            />
            {header ? (
                <div
                    className="rich-props-container__header"
                    contentEditable={false}
                >
                    {header}
                </div>
            ) : null}
            <NodeViewContent
                className={
                    contentClassName ?? "rich-container-block__content"
                }
            />
        </NodeViewWrapper>
    )
}

export function ExpanderContainerView(
    props: NodeViewProps
): React.ReactElement {
    const { title, subtitle } = getContainerProps(props) as {
        title?: string
        subtitle?: string
    }
    return (
        <PropsContainerChrome
            nodeViewProps={props}
            blockType="expander"
            header={
                <>
                    <strong>{title || "Untitled expander"}</strong>
                    {subtitle ? <p>{subtitle}</p> : null}
                </>
            }
        />
    )
}

export function GuidedChartContainerView(
    props: NodeViewProps
): React.ReactElement {
    return (
        <PropsContainerChrome nodeViewProps={props} blockType="guided-chart" />
    )
}

export function AlignContainerView(props: NodeViewProps): React.ReactElement {
    const alignment = String(getContainerProps(props).alignment ?? "left")
    return (
        <PropsContainerChrome
            nodeViewProps={props}
            blockType="align"
            summary={alignment}
            contentClassName={`rich-container-block__content rich-align-block__content--${alignment}`}
        />
    )
}

export function DataCalloutContainerView(
    props: NodeViewProps
): React.ReactElement {
    const url = String(getContainerProps(props).url ?? "")
    return (
        <PropsContainerChrome
            nodeViewProps={props}
            blockType="data-callout"
            summary={url.replace(/^https?:\/\/[^/]+/, "") || "no chart chosen"}
        />
    )
}

export function DataCalloutGroupContainerView(
    props: NodeViewProps
): React.ReactElement {
    return (
        <PropsContainerChrome
            nodeViewProps={props}
            blockType="data-callout-group"
        />
    )
}

export function ExploreDataSectionContainerView(
    props: NodeViewProps
): React.ReactElement {
    const { title } = getContainerProps(props) as { title?: string }
    return (
        <PropsContainerChrome
            nodeViewProps={props}
            blockType="explore-data-section"
            summary={title}
        />
    )
}

export function ConditionalSectionContainerView(
    props: NodeViewProps
): React.ReactElement {
    const { include = [], exclude = [] } = getContainerProps(props) as {
        include?: string[]
        exclude?: string[]
    }
    const parts = [
        include.length > 0 ? `include: ${include.join(", ")}` : "",
        exclude.length > 0 ? `exclude: ${exclude.join(", ")}` : "",
    ].filter(Boolean)
    return (
        <PropsContainerChrome
            nodeViewProps={props}
            blockType="conditional-section"
            summary={parts.join(" · ") || "no conditions"}
        />
    )
}

export function TopicPageIntroContainerView(
    props: NodeViewProps
): React.ReactElement {
    const { downloadButton, relatedTopics } = getContainerProps(props) as {
        downloadButton?: { text: string; url: string }
        relatedTopics?: { text?: string; url: string }[]
    }
    const chips: string[] = []
    if (downloadButton) chips.push(`⭳ ${downloadButton.text}`)
    for (const topic of relatedTopics ?? []) {
        chips.push(topic.text || topic.url)
    }
    return (
        <PropsContainerChrome
            nodeViewProps={props}
            blockType="topic-page-intro"
            header={
                chips.length > 0 ? (
                    <div className="rich-props-container__chips">
                        {chips.map((chip, index) => (
                            <span
                                key={index}
                                className="rich-props-container__chip"
                            >
                                {chip}
                            </span>
                        ))}
                    </div>
                ) : null
            }
            contentClassName="rich-container-block__content rich-topic-page-intro__content"
        />
    )
}

export function PullChartContainerView(
    props: NodeViewProps
): React.ReactElement {
    const { image, url } = getContainerProps(props) as {
        image?: string
        url?: string
    }
    return (
        <PropsContainerChrome
            nodeViewProps={props}
            blockType="pull-chart"
            summary={image || url || "no chart chosen"}
        />
    )
}

export function KeyInsightsContainerView(
    props: NodeViewProps
): React.ReactElement {
    const heading = String(getContainerProps(props).heading ?? "")
    return (
        <PropsContainerChrome
            nodeViewProps={props}
            blockType="key-insights"
            summary={`${props.node.childCount} slides`}
            header={<strong>{heading || "Key insights"}</strong>}
            contentClassName="rich-container-block__content rich-key-insights__slides"
        />
    )
}

/**
 * One key-insight slide. Structural child of keyInsights (like a table row):
 * no drag frame; its title bar selects the slide so its settings (title,
 * chart/image) and the add/move/delete slide commands open in the right rail.
 */
export function KeyInsightSlideView(props: NodeViewProps): React.ReactElement {
    const slide = getContainerProps(props) as {
        title?: string
        filename?: string
        url?: string
        narrativeChartName?: string
    }
    const visual = slide.url || slide.narrativeChartName || slide.filename
    const select = (): void => {
        const pos = props.getPos()
        if (pos === undefined) return
        props.editor.chain().focus().setNodeSelection(pos).run()
    }
    return (
        <NodeViewWrapper
            className={`rich-key-insight-slide${
                props.selected ? " rich-block--selected" : ""
            }`}
        >
            <div
                className="rich-key-insight-slide__header"
                contentEditable={false}
                onClick={select}
                title="Click to edit this slide's settings"
            >
                <strong>{slide.title || "Untitled slide"}</strong>
                <span className="rich-key-insight-slide__visual">
                    {visual || "no chart or image"}
                </span>
            </div>
            <NodeViewContent className="rich-key-insight-slide__content" />
        </NodeViewWrapper>
    )
}
