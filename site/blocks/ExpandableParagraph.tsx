import React, { useState } from "react"
import cx from "classnames"
import ReactDOM from "react-dom"
import ReactDOMServer from "react-dom/server.js"

export const ExpandableParagraph = (
    props:
        | {
              children: React.ReactNode
              dangerouslySetInnerHTML?: undefined
              className?: string
              buttonVariant?: "slim" | "full"
          }
        | {
              children?: undefined
              dangerouslySetInnerHTML: {
                  __html: string
              }
              className?: string
              buttonVariant?: "slim" | "full"
          }
) => {
    const [isExpanded, setIsExpanded] = useState(false)

    const { className, buttonVariant = "full", ...propsWithoutStyles } = props

    return (
        <div className={cx("expandable-paragraph", className)}>
            <div
                className={cx("expandable-paragraph__content", {
                    "expandable-paragraph__content--is-expanded": isExpanded,
                })}
                // Either pass children or dangerouslySetInnerHTML
                {...propsWithoutStyles}
            />
            {!isExpanded && (
                <button
                    className={cx(
                        "expandable-paragraph__expand-button",
                        `expandable-paragraph__expand-button--${buttonVariant}`
                    )}
                    onClick={() => setIsExpanded(true)}
                >
                    Show more
                </button>
            )}
        </div>
    )
}

export const hydrateExpandableParagraphs = () => {
    const expandableParagraphs = document.querySelectorAll(
        ".expandable-paragraph"
    )

    expandableParagraphs.forEach((eP) => {
        const innerHTML = eP.innerHTML
        ReactDOM.hydrate(
            <ExpandableParagraph
                dangerouslySetInnerHTML={{ __html: innerHTML }}
                buttonVariant="slim"
            />,
            eP.parentElement
        )
    })
}

export const renderExpandableParagraphs = ($: CheerioStatic) => {
    const expandableParagraphs = $('block[type="expandable-paragraph"]')
    expandableParagraphs.each((_, eP) => {
        const $el = $(eP)
        const $dry = $(
            ReactDOMServer.renderToStaticMarkup(
                <div>
                    <ExpandableParagraph
                        dangerouslySetInnerHTML={{
                            __html: $el.html() || "",
                        }}
                        buttonVariant="slim"
                    />
                </div>
            )
        )
        $el.after($dry)
        $el.remove()
    })
}
