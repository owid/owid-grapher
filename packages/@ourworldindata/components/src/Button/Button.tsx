import React from "react"
import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { IconDefinition, faArrowRight } from "@fortawesome/free-solid-svg-icons"

type ButtonCommonProps = {
    text: string
    className?: string
    theme: "solid-vermillion" | "outline-vermillion"
    /** Set to null to hide the icon */
    icon?: IconDefinition | null
}

type WithHrefProps = {
    href: string
    onClick?: never
}

type WithOnClickProps = {
    onClick: () => void
    href?: never
}

export type ButtonProps =
    | (ButtonCommonProps & WithHrefProps)
    | (ButtonCommonProps & WithOnClickProps)

export const Button = ({
    theme = "solid-vermillion",
    className,
    href,
    onClick,
    text,
    icon = faArrowRight,
}: ButtonProps) => {
    const classes = cx("owid-btn", `owid-btn--${theme}`, className)

    if (href) {
        return (
            <a
                className={classes}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
            >
                {text} {icon && <FontAwesomeIcon icon={icon} />}
            </a>
        )
    }

    return (
        <button className={classes} onClick={onClick}>
            {text} {icon && <FontAwesomeIcon icon={icon} />}
        </button>
    )
}
