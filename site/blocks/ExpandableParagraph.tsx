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
                    className="expandable-paragraph__content"
                    // Either pass children or dangerouslySetInnerHTML
                    {...propsWithoutStyles}
                />
            </AnimateHeight>

            <div
                className="expandable-paragraph__gradient-wrapper"
                style={{ marginTop: -CLOSED_HEIGHT, height: CLOSED_HEIGHT }}
            >
                <div
                    className="expandable-paragraph__gradient"
                    // When the block is opening, we're sliding the gradient
                    // down and out of the gradient-wrapper frame, which has an
                    // overflow:hidden.
                    style={{ marginTop: isClosed ? 0 : CLOSED_HEIGHT }}
                />
            </div>
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
