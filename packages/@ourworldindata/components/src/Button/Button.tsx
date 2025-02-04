import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { IconDefinition, faArrowRight } from "@fortawesome/free-solid-svg-icons"

type ButtonCommonProps = {
    text: string
    className?: string
    theme: "solid-vermillion" | "outline-vermillion" | "solid-blue"
    /** Set to null to hide the icon */
    icon?: IconDefinition | null
    dataTrackNote?: string
}

type WithHrefProps = {
    href: string
    onClick?: never
    ariaLabel?: never
    type?: never
}

type WithOnClickProps = {
    onClick?: () => void
    href?: never
    ariaLabel: string
    type?: "button" | "submit"
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
    ariaLabel,
    type = "button",
    icon = faArrowRight,
    dataTrackNote,
}: ButtonProps) => {
    const classes = cx("owid-btn", `owid-btn--${theme}`, className)

    if (href) {
        const aProps = {
            href,
            className: classes,
            "data-track-note": dataTrackNote,
        }
        return (
            <a {...aProps}>
                {text} {icon && <FontAwesomeIcon icon={icon} />}
            </a>
        )
    }

    const buttonProps = {
        type,
        className: classes,
        onClick,
        "aria-label": ariaLabel,
        "data-track-note": dataTrackNote,
    }
    return (
        <button {...buttonProps}>
            {text} {icon && <FontAwesomeIcon icon={icon} />}
        </button>
    )
}
