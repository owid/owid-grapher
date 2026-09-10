import { useRef, useState } from "react"
import * as React from "react"
import cx from "clsx"

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
    const [isClosed, setIsClosed] = useState(true)
    const containerRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)

    const { className, buttonVariant = "full", ...propsWithoutStyles } = props

    const toggleExpanded = () => {
        const currentContainer = containerRef.current
        const currentButton = buttonRef.current
        if (!isClosed) {
            if (currentContainer && currentButton) {
                const containerTop =
                    currentContainer.getBoundingClientRect().top
                const buttonTop = currentButton.getBoundingClientRect().top
                window.scrollTo({
                    top:
                        window.scrollY +
                        containerTop -
                        buttonTop +
                        CLOSED_HEIGHT +
                        BUTTON_HEIGHT / 2,
                    behavior: "auto",
                })
            }
            setIsClosed(true)
        } else {
            setIsClosed(false)
        }
    }

    return (
        <div className={cx("expandable-paragraph", className)}>
            <div
                // inert prevents focus on elements that are not visible
                // ideally would only apply to elements below the fold but that's hard
                inert={isClosed}
                ref={containerRef}
                // Either pass children or dangerouslySetInnerHTML
                {...propsWithoutStyles}
                className={cx("expandable-paragraph__content", {
                    "expandable-paragraph__content--closed": isClosed,
                })}
            />

            <button
                aria-label="Expand paragraph"
                className={cx(
                    "expandable-paragraph__expand-button",
                    `expandable-paragraph__expand-button--${buttonVariant}`
                )}
                style={{
                    height: BUTTON_HEIGHT,
                }}
                onClick={toggleExpanded}
                ref={buttonRef}
            >
                {isClosed ? "Show more" : "Show less"}
            </button>
        </div>
    )
}
