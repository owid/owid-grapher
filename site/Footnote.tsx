import { Tippy } from "../covid/node_modules/grapher/chart/Tippy"
import { parseIntOrUndefined } from "../covid/node_modules/clientUtils/Util"
import React from "react"
import ReactDOM from "react-dom"

export const Footnote = ({
    index,
    htmlContent,
    triggerTarget,
}: {
    index: number
    htmlContent?: string
    triggerTarget?: Element
}) => {
    const onEvent = (instance: any, event: Event) => {
        if (event.type === "click") event.preventDefault()
    }

    return (
        <Tippy
            appendTo={() => document.body}
            content={
                htmlContent && (
                    <div>
                        <div
                            dangerouslySetInnerHTML={{
                                __html: htmlContent,
                            }}
                        />
                    </div>
                )
            }
            interactive
            placement="auto"
            theme="owid-footnote"
            trigger="mouseenter focus click"
            triggerTarget={triggerTarget}
            onTrigger={onEvent}
            onUntrigger={onEvent}
        >
            <sup>{index}</sup>
        </Tippy>
    )
}

interface FootnoteContent {
    index: number
    href: string
    htmlContent: string
}

function getFootnoteContent(element: Element): FootnoteContent | null {
    const href = element.closest("a.ref")?.getAttribute("href")
    if (!href) return null

    const index = parseIntOrUndefined(href.split("-")[1])
    if (index === undefined) return null

    const referencedEl = document.querySelector(href)
    if (!referencedEl?.innerHTML) return null
    return { index, href, htmlContent: referencedEl.innerHTML }
}

export function runFootnotes() {
    const footnotes = document.querySelectorAll("a.ref")

    footnotes.forEach((f) => {
        const footnoteContent = getFootnoteContent(f)
        if (footnoteContent == null) return

        ReactDOM.hydrate(
            <Footnote
                index={footnoteContent.index}
                htmlContent={footnoteContent.htmlContent}
                triggerTarget={f}
            />,
            f
        )
    })
}
