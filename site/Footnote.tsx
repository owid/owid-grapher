import { SpanRef } from "@ourworldindata/types"
import { Tippy } from "@ourworldindata/utils"
import { useDocumentContext } from "./gdocs/DocumentContext.js"
import ArticleBlock from "./gdocs/components/ArticleBlock.js"
import SpanElements from "./gdocs/components/SpanElements.js"

export const Footnote = ({ span }: { span: SpanRef }) => {
    const { footnotes } = useDocumentContext()
    const footnote = Object.values(footnotes ?? {}).find(
        (ref) => span.url === `#note-${ref.index + 1}`
    )
    const reference = (
        <a href={span.url} className="ref">
            <SpanElements spans={span.children} />
        </a>
    )

    if (!footnote) return reference

    const onEvent = (_instance: unknown, event: Event): void => {
        if (event.type === "click") event.preventDefault()
    }

    return (
        <Tippy
            appendTo={() => document.body}
            content={
                <div>
                    {footnote.content.map((block, i) => (
                        <ArticleBlock key={i} b={block} />
                    ))}
                </div>
            }
            interactive
            interactiveDebounce={50}
            placement="bottom"
            theme="owid-footnote"
            trigger="mouseenter focus click"
            onTrigger={onEvent}
            onUntrigger={onEvent}
        >
            {reference}
        </Tippy>
    )
}
