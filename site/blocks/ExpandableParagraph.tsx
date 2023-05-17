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
          }
        | {
              children?: undefined
              dangerouslySetInnerHTML: {
                  __html: string
              }
              className?: string
          }
) => {
    const [isExpanded, setIsExpanded] = useState(false)

    const { className, ...propsWithoutClassName } = props
    return (
        <div className={cx("expandable-paragraph", className)}>
            <div
                className={cx("expandable-paragraph__content", {
                    "expandable-paragraph__content--is-expanded": isExpanded,
                })}
                // Either pass children or dangerouslySetInnerHTML
                {...propsWithoutClassName}
            />
            {!isExpanded && (
                <button
                    className="expandable-paragraph__expand-button"
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
                    />
                </div>
            )
        )
        $el.after($dry)
        $el.remove()
    })
}
