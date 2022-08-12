import React, { useState } from "react"
import classnames from "classnames"
import ReactDOM from "react-dom"
import ReactDOMServer from "react-dom/server.js"

export const ExpandableParagraph = (
    props:
        | {
              children: React.ReactNode
              dangerouslySetInnerHTML?: undefined
          }
        | {
              children?: undefined
              dangerouslySetInnerHTML: {
                  __html: string
              }
          }
) => {
    const [isExpanded, setIsExpanded] = useState(false)

    return (
        <>
            <div
                className={classnames("expandable-paragraph", {
                    "expandable-paragraph--is-expanded": isExpanded,
                })}
                // Either pass children or dangerouslySetInnerHTML
                {...props}
            />
            {!isExpanded && (
                <button
                    className="expandable-paragraph__expand-button"
                    onClick={() => setIsExpanded(true)}
                >
                    Continue reading
                </button>
            )}
        </>
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
