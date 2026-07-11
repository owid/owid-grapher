import { useMemo } from "react"
import Markdown, { type Components as MarkdownComponents } from "react-markdown"
import { ComponentExample } from "@ourworldindata/types"
import { Link } from "./Link.js"
import { GdocsReferenceExample } from "./GdocsReferenceExample.js"

// react-markdown passes the <code> element as the <pre>'s child; pull its
// text out so we can match it against the doc's examples.
function extractCodeText(children: React.ReactNode): string {
    const codeElement = children as
        | React.ReactElement<{ children?: React.ReactNode }>
        | undefined
    const codeChildren = codeElement?.props?.children
    return typeof codeChildren === "string"
        ? codeChildren.replace(/\n$/, "")
        : ""
}

// Inline code like `{.chart-rows}` referencing another component
const COMPONENT_MENTION = /^\{\.([a-z0-9-]+)\}$/

/**
 * Renders a one-line snippet of sidecar markdown as plain text with `code`
 * spans — for card descriptions and field-description table cells, where a
 * full markdown renderer would be overkill.
 */
export function InlineMarkdownText({
    text,
}: {
    text: string
}): React.ReactElement {
    const parts = text.split(/`([^`]*)`/)
    return (
        <>
            {parts.map((part, index) =>
                index % 2 === 1 ? <code key={index}>{part}</code> : part
            )}
        </>
    )
}

// Stable defaults for bodies without examples (template sidecars), so the
// useMemo below doesn't recompute on every render.
const NO_EXAMPLES: ComponentExample[] = []
const NO_PREVIEW = (): undefined => undefined

/**
 * Renders a sidecar's markdown body. The fenced archie examples embedded in
 * the body are replaced in place with the interactive example widget
 * (rendered preview ⇄ copyable ArchieML), and inline mentions of other
 * components (`{.chart-rows}`) become links to their reference page.
 */
export function GdocsReferenceMarkdown({
    body,
    examples = NO_EXAMPLES,
    previewPathForExample = NO_PREVIEW,
    componentIds,
    componentId,
}: {
    body: string
    examples?: ComponentExample[]
    /** Returns the admin path rendering the example, or undefined for none */
    previewPathForExample?: (exampleIndex: number) => string | undefined
    /** Known component ids, used to link `{.id}` mentions */
    componentIds: Set<string>
    /** The component this body documents; enables per-example Copy prompt */
    componentId?: string
}): React.ReactElement {
    const markdownComponents: MarkdownComponents = useMemo(
        () => ({
            pre: ({ children }) => {
                const code = extractCodeText(children)
                const exampleIndex = examples.findIndex(
                    (example) => example.archie.trim() === code.trim()
                )
                return (
                    <GdocsReferenceExample
                        archie={code}
                        previewPath={
                            exampleIndex >= 0
                                ? previewPathForExample(exampleIndex)
                                : undefined
                        }
                        componentId={componentId}
                    />
                )
            },
            code: ({ children, ...props }) => {
                if (typeof children === "string") {
                    const mention = COMPONENT_MENTION.exec(children)
                    if (mention && componentIds.has(mention[1]))
                        return (
                            <Link
                                className="gdocs-ref__component-mention"
                                to={`/gdocs-reference/components/${mention[1]}`}
                            >
                                <code>{children}</code>
                            </Link>
                        )
                }
                return <code {...props}>{children}</code>
            },
        }),
        [examples, previewPathForExample, componentIds, componentId]
    )

    return (
        <div className="gdocs-ref__body">
            <Markdown components={markdownComponents}>{body}</Markdown>
        </div>
    )
}
