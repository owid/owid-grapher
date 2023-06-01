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
    const CLOSED_HEIGHT = 100
    const [height, setHeight] = useState<"auto" | number>(CLOSED_HEIGHT)

    const isClosed = height === CLOSED_HEIGHT
    const { className, buttonVariant = "full", ...propsWithoutStyles } = props

    const toggleExpanded = () => {
        setHeight(isClosed ? "auto" : CLOSED_HEIGHT)
    }

    const maskColor = isClosed ? "transparent" : "#000"
    const contentStyles = {
        WebkitMaskImage: `linear-gradient(180deg, #000 0%, ${maskColor})`,
        height,
    }

    return (
        <div className={cx("expandable-paragraph", className)}>
            <div
                style={contentStyles}
                // Either pass children or dangerouslySetInnerHTML
                {...propsWithoutStyles}
            />

            <button
                className={cx(
                    "expandable-paragraph__expand-button",
                    `expandable-paragraph__expand-button--${buttonVariant}`
                )}
                onClick={toggleExpanded}
            >
                {isClosed ? "Show more" : "Show less"}
            </button>
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
