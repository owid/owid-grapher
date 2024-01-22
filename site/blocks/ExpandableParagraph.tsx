import React, { CSSProperties, useRef, useState } from "react"
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
    const BUTTON_HEIGHT = 40
    const EXPANDED_HEIGHT = `calc(100% - ${BUTTON_HEIGHT}px)`
    const [height, setHeight] = useState<typeof EXPANDED_HEIGHT | number>(
        CLOSED_HEIGHT
    )
    const containerRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)

    const isClosed = height === CLOSED_HEIGHT
    const { className, buttonVariant = "full", ...propsWithoutStyles } = props

    const toggleExpanded = () => {
        const currentContainer = containerRef.current
        const currentButton = buttonRef.current
        if (currentContainer && currentButton && !isClosed) {
            const containerTop = currentContainer.getBoundingClientRect().top
            const buttonTop = currentButton.getBoundingClientRect().top
            window.scrollTo({
                top:
                    window.scrollY +
                    containerTop -
                    buttonTop +
                    CLOSED_HEIGHT +
                    BUTTON_HEIGHT / 2,
                behavior: "smooth",
            })
            setTimeout(() => {
                setHeight(isClosed ? EXPANDED_HEIGHT : CLOSED_HEIGHT)
            }, 1000)
        } else {
            setHeight(isClosed ? EXPANDED_HEIGHT : CLOSED_HEIGHT)
        }
    }

    const maskColor = isClosed ? "transparent" : "#000"
    const contentStyles: CSSProperties = {
        WebkitMaskImage: `linear-gradient(180deg, #000 0%, ${maskColor})`,
        transition: "height 200ms",
        height,
    }

    return (
        <div className={cx("expandable-paragraph", className)}>
            <div
                style={contentStyles}
                ref={containerRef}
                // Either pass children or dangerouslySetInnerHTML
                {...propsWithoutStyles}
                className="expandable-paragraph__content"
            />

            <button
                aria-label="Expand paragraph"
                className={cx(
                    "expandable-paragraph__expand-button",
                    `expandable-paragraph__expand-button--${buttonVariant}`
                )}
                style={{
                    height: BUTTON_HEIGHT,
                    position: "relative",
                    top: isClosed ? undefined : -40,
                }}
                onClick={toggleExpanded}
                ref={buttonRef}
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
