import { CSSProperties, useRef, useState } from "react"
import * as React from "react"
import cx from "classnames"

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
    const [isExpanded, setIsExpanded] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)

    const { className, buttonVariant = "full", ...propsWithoutStyles } = props

    const toggleExpanded = () => {
        if (isExpanded) {
            const currentContainer = containerRef.current
            const currentButton = buttonRef.current
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
                        20,
                    behavior: "smooth",
                })
                setTimeout(() => setIsExpanded(false), 1000)
                return
            }
        }
        setIsExpanded(!isExpanded)
    }

    const contentStyles: CSSProperties = isExpanded
        ? {}
        : {
              height: CLOSED_HEIGHT,
              WebkitMaskImage: "linear-gradient(180deg, #000 0%, transparent)",
              overflow: "hidden",
          }

    return (
        <div className={cx("expandable-paragraph", className)}>
            <div
                style={contentStyles}
                // inert prevents focus on elements that are not visible
                // ideally would only apply to elements below the fold but that's hard
                inert={!isExpanded}
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
                onClick={toggleExpanded}
                ref={buttonRef}
            >
                {isExpanded ? "Show less" : "Show more"}
            </button>
        </div>
    )
}
