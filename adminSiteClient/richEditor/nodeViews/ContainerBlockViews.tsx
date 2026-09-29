import { NodeViewContent, NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import { BlockFrame } from "./BlockFrame.js"

// NodeViews for the container blocks (two-column layouts, gray section,
// expandable paragraph, blockquote, callout, aside, pull quote, table).
// Their children stay fully editable via NodeViewContent; the BlockFrame
// adds the hover border for selecting, dragging and deleting the block as
// a whole (and, once selected, editing its settings in the right rail).

function ContainerChrome(props: {
    nodeViewProps: NodeViewProps
    blockType: string
    wrapperClassName: string
    contentClassName?: string
}): React.ReactElement {
    const { nodeViewProps, blockType, wrapperClassName, contentClassName } =
        props
    return (
        <NodeViewWrapper
            className={`${wrapperClassName}${
                nodeViewProps.selected ? " rich-block--selected" : ""
            }`}
        >
            <BlockFrame nodeViewProps={nodeViewProps} label={blockType} />
            <NodeViewContent className={contentClassName} />
        </NodeViewWrapper>
    )
}

export function StickyRightBlockView(props: NodeViewProps): React.ReactElement {
    return (
        <ContainerChrome
            nodeViewProps={props}
            blockType="sticky-right"
            wrapperClassName="rich-container-block rich-container-block--sticky-right"
            contentClassName="rich-two-column__columns"
        />
    )
}

export function StickyLeftBlockView(props: NodeViewProps): React.ReactElement {
    return (
        <ContainerChrome
            nodeViewProps={props}
            blockType="sticky-left"
            wrapperClassName="rich-container-block rich-container-block--sticky-left"
            contentClassName="rich-two-column__columns"
        />
    )
}

export function SideBySideBlockView(props: NodeViewProps): React.ReactElement {
    return (
        <ContainerChrome
            nodeViewProps={props}
            blockType="side-by-side"
            wrapperClassName="rich-container-block rich-container-block--side-by-side"
            contentClassName="rich-two-column__columns"
        />
    )
}

export function GraySectionBlockView(props: NodeViewProps): React.ReactElement {
    return (
        <ContainerChrome
            nodeViewProps={props}
            blockType="gray-section"
            wrapperClassName="rich-container-block rich-container-block--gray-section"
            contentClassName="rich-container-block__content"
        />
    )
}

export function ExpandableParagraphBlockView(
    props: NodeViewProps
): React.ReactElement {
    return (
        <ContainerChrome
            nodeViewProps={props}
            blockType="expandable-paragraph"
            wrapperClassName="rich-container-block rich-container-block--expandable-paragraph"
            contentClassName="rich-container-block__content"
        />
    )
}

// Text-like containers: styled like their article counterparts, centered at
// the article text measure

export function BlockquoteBlockView(props: NodeViewProps): React.ReactElement {
    return (
        <ContainerChrome
            nodeViewProps={props}
            blockType="quote"
            wrapperClassName="rich-text-block rich-blockquote-block"
        />
    )
}

export function AsideBlockView(props: NodeViewProps): React.ReactElement {
    return (
        <ContainerChrome
            nodeViewProps={props}
            blockType="aside"
            wrapperClassName="rich-text-block rich-aside-block"
        />
    )
}

export function CalloutBlockView(props: NodeViewProps): React.ReactElement {
    const title = props.node.attrs.title as string | null
    return (
        <NodeViewWrapper
            className={`rich-text-block rich-callout-block${
                props.selected ? " rich-block--selected" : ""
            }`}
        >
            <BlockFrame nodeViewProps={props} label="callout" />
            {title ? (
                <div
                    className="rich-callout-block__title"
                    contentEditable={false}
                >
                    {title}
                </div>
            ) : null}
            <NodeViewContent />
        </NodeViewWrapper>
    )
}

/**
 * The pull quote's display text lives in the `quote` attr (edited in the
 * right rail); the content hole holds the attribution/context text blocks.
 */
export function PullQuoteContainerView(
    props: NodeViewProps
): React.ReactElement {
    const quote = String(props.node.attrs.quote ?? "")
    const align = String(props.node.attrs.align ?? "left")
    return (
        <NodeViewWrapper
            className={`rich-container-block rich-pull-quote-block${
                props.selected ? " rich-block--selected" : ""
            }`}
        >
            <BlockFrame
                nodeViewProps={props}
                label="pull-quote"
                summary={`align: ${align}`}
            />
            <blockquote
                className="rich-pull-quote-block__quote"
                contentEditable={false}
            >
                {quote ? (
                    `“${quote}”`
                ) : (
                    <span className="rich-pull-quote-block__placeholder">
                        Set the quote text in the right rail
                    </span>
                )}
            </blockquote>
            <NodeViewContent className="rich-pull-quote-block__content" />
        </NodeViewWrapper>
    )
}

/**
 * Tables are nested containers: cells hold real editable blocks, so text
 * can be typed and blocks dragged into any cell. Template/size/caption are
 * edited in the right rail.
 */
export function TableContainerView(props: NodeViewProps): React.ReactElement {
    const template = String(props.node.attrs.template ?? "header-row")
    const size = String(props.node.attrs.size ?? "narrow")
    return (
        <NodeViewWrapper
            className={`rich-container-block rich-table-block rich-table-block--${template} rich-table-block--size-${size}${
                props.selected ? " rich-block--selected" : ""
            }`}
        >
            <BlockFrame
                nodeViewProps={props}
                label="table"
                summary={`${props.node.childCount} rows`}
            />
            <NodeViewContent className="rich-table-block__content" />
        </NodeViewWrapper>
    )
}
