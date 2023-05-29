import React, { useState } from "react"
import cx from "classnames"
import ReactDOM from "react-dom"
import ReactDOMServer from "react-dom/server.js"
import AnimateHeight from "react-animate-height"

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

    return (
        <div className={cx("expandable-paragraph", className)}>
            <AnimateHeight height={height}>
                <div
                    className={cx("expandable-paragraph__content", {
                        "expandable-paragraph__content--is-closed": isClosed,
                    })}
                    // Either pass children or dangerouslySetInnerHTML
                    {...propsWithoutStyles}
                />
            </AnimateHeight>
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
