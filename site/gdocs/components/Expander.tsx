import React from "react"
import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons"

export const Expander = (props: {
    className?: string
    children: React.ReactNode
    title: string
    heading: string
    subtitle?: string
}) => {
    const { className } = props

    return (
        <details className={cx("expander", className)}>
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
