import React, { useEffect } from "react"
import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons"
import { SiteAnalytics } from "../../SiteAnalytics.js"

const analytics = new SiteAnalytics()

export const Expander = (props: {
    className?: string
    children: React.ReactNode
    title: string
    heading?: string
    subtitle?: string
}) => {
    const { className } = props
    const expanderRef = React.createRef<HTMLDetailsElement>()

    useEffect(() => {
        const expander = expanderRef.current
        if (expander) {
            expander.addEventListener("toggle", () => {
                if (expander.open) {
                    analytics.logExpanderOpen(props.title)
                } else {
                    analytics.logExpanderClose(props.title)
                }
            })
        }
    }, [expanderRef, props.title])

    return (
        <details ref={expanderRef} className={cx("expander", className)}>
            <summary className="expander__summary">
                {props.heading && (
                    <span className="body-3-bold expander__heading">
                        {props.heading}
                    </span>
                )}
                <span className="h4-semibold expander__title">
                    {props.title}
                </span>
                {props.subtitle && (
                    <span className="body-3-regular expander__subtitle">
                        {props.subtitle}
                    </span>
                )}
                <FontAwesomeIcon
                    icon={faPlus}
                    className="expander__status-icon plus"
                />
                <FontAwesomeIcon
                    icon={faMinus}
                    className="expander__status-icon minus"
                />
            </summary>
            {props.children}
        </details>
    )
}
