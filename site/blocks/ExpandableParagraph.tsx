import React, { useLayoutEffect, useRef, useState } from "react"
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
    const buttonRef = useRef<HTMLButtonElement>(null)
    const prevTopRef = useRef<number>(0)

    const isClosed = height === CLOSED_HEIGHT
    const { className, buttonVariant = "full", ...propsWithoutStyles } = props

    const toggleExpanded = () => {
        if (!isClosed && buttonRef.current) {
            // Store where in the screen the button was before closing
            prevTopRef.current = buttonRef.current.getBoundingClientRect().top
        }
        setHeight(isClosed ? "auto" : CLOSED_HEIGHT)
    }

    useLayoutEffect(() => {
        const currentButton = buttonRef.current
        const prevTop = prevTopRef.current

        // prevTop === 0 is the intial render, where we don't want to do anything
        if (prevTop && currentButton && isClosed) {
            // Store where in the screen the button is now (likely a negative number i.e. off-screen, above)
            const currentTop = currentButton.getBoundingClientRect().top
            window.scrollTo({
                // Scroll up by the difference between where the button used to be and where it is now
                // e.g. prevTop = 1000, currentTop = -500, scroll up by 1500 pixels so that currentTop will equal 1000 again
                top: window.scrollY - (prevTop - currentTop),
            })
        }
    }, [buttonRef, height, prevTopRef, isClosed])

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
                className="expandable-paragraph__content"
            />

            <button
                ref={buttonRef}
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
