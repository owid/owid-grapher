import { useMemo, useRef } from "react"
import Markdown, { type Components as MarkdownComponents } from "react-markdown"
import {
    RelatedRef,
    SidecarExample,
    SidecarSectionKey,
} from "@ourworldindata/types"
import { Link } from "./Link.js"
import { GdocsReferenceExample } from "./GdocsReferenceExample.js"
import {
    exampleIndexForFence,
    parseMention,
    referencePathFor,
} from "./gdocsReferenceExamples.js"

// react-markdown passes the <code> element as the <pre>'s child; pull its
// text out to hand it to the example widget.
function extractCodeText(children: React.ReactNode): string {
    const codeElement = children as
        | React.ReactElement<{ children?: React.ReactNode }>
        | undefined
    const codeChildren = codeElement?.props?.children
    return typeof codeChildren === "string"
        ? codeChildren.replace(/\n$/, "")
        : ""
}

/** Resolves a mention's target to the text shown for it in the link */
export type TitleFor = (ref: RelatedRef) => string | undefined

/**
 * An inline code span: a `{.component-id}` mention becomes a link to that
 * component page, keeping its ArchieML form as the link text — authors
 * recognise that shape. A `{guide:id}` / `{template:id}` mention instead
 * links to the target's title, styled as a small pill rather than code
 * (falling back to the raw mention text when no title resolves). Anything
 * else stays plain code.
 */
function CodeSpan({
    text,
    titleFor,
}: {
    text: string
    titleFor?: TitleFor
}): React.ReactElement {
    const mention = parseMention(text)
    if (!mention) return <code>{text}</code>
    if (mention.kind === "component")
        return (
            <Link className="gdocs-ref__mention" to={referencePathFor(mention)}>
                <code>{text}</code>
            </Link>
        )
    return (
        <Link
            className="gdocs-ref__mention gdocs-ref__mention--titled"
            to={referencePathFor(mention)}
        >
            {titleFor?.(mention) ?? text}
        </Link>
    )
}

/**
 * Renders a one-line snippet of sidecar markdown as plain text with `code`
 * spans — for card descriptions and field-description table cells, where a
 * full markdown renderer would be overkill. Mentions link like everywhere.
 */
export function InlineMarkdownText({
    text,
    titleFor,
}: {
    text: string
    titleFor?: TitleFor
}): React.ReactElement {
    const parts = text.split(/`([^`]*)`/)
    return (
        <>
            {parts.map((part, index) =>
                index % 2 === 1 ? (
                    <CodeSpan key={index} text={part} titleFor={titleFor} />
                ) : (
                    part
                )
            )}
        </>
    )
}

// Stable default for bodies without examples (template sidecars), so the
// useMemo below doesn't recompute on every render.
const NO_EXAMPLES: SidecarExample[] = []
const NO_PREVIEW = (): undefined => undefined

/**
 * Renders one prose section of a sidecar. Fenced examples are replaced in
 * place with the example widget (rendered preview ⇄ copyable ArchieML when a
 * preview path exists, code only otherwise). The n-th fence met in this
 * section is the example with position n — matching by place, not by text.
 */
export function GdocsReferenceMarkdown({
    body,
    section,
    examples = NO_EXAMPLES,
    previewPathForExample = NO_PREVIEW,
    titleFor,
}: {
    body: string
    /** Which prose field `body` is — the fence positions are relative to it */
    section: SidecarSectionKey
    examples?: SidecarExample[]
    /** Returns the admin path rendering the example, or undefined for none */
    previewPathForExample?: (exampleIndex: number) => string | undefined
    /** Resolves a `{guide:id}` / `{template:id}` mention to its title */
    titleFor?: TitleFor
}): React.ReactElement {
    // Fences are numbered in render order; react-markdown renders a body's
    // children synchronously in document order, so a counter reset before
    // each render pass yields each fence's ordinal within this section.
    const fenceOrdinal = useRef(0)
    fenceOrdinal.current = 0

    // The renderers below are created once and read the latest props from
    // this ref. A new renderer function would be a new element type to
    // React, unmounting every example widget — and reloading its preview
    // iframe — whenever a parent re-renders (each keystroke in the sidebar
    // search does).
    const latest = useRef({
        examples,
        section,
        previewPathForExample,
        titleFor,
    })
    latest.current = { examples, section, previewPathForExample, titleFor }

    const markdownComponents: MarkdownComponents = useMemo(
        () => ({
            pre: ({ children }) => {
                const { examples, section, previewPathForExample } =
                    latest.current
                const code = extractCodeText(children)
                const ordinal = fenceOrdinal.current++
                const exampleIndex = exampleIndexForFence(
                    examples,
                    section,
                    ordinal
                )
                const example =
                    exampleIndex !== undefined
                        ? examples[exampleIndex]
                        : undefined
                return (
                    <GdocsReferenceExample
                        archie={code}
                        previewPath={
                            exampleIndex !== undefined &&
                            example?.flavour === "archie"
                                ? previewPathForExample(exampleIndex)
                                : undefined
                        }
                        wholeDocument={example?.flavour === "archie-document"}
                    />
                )
            },
            code: ({ children, ...props }) => {
                if (typeof children === "string")
                    return (
                        <CodeSpan
                            text={children}
                            titleFor={latest.current.titleFor}
                        />
                    )
                return <code {...props}>{children}</code>
            },
        }),
        []
    )

    return (
        <div className="gdocs-ref__body">
            <Markdown components={markdownComponents}>{body}</Markdown>
        </div>
    )
}
