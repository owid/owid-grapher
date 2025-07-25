import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { IconDefinition, faArrowRight } from "@fortawesome/free-solid-svg-icons"

type ButtonCommonProps = {
    text: string
    className?: string
    theme:
        | "solid-vermillion"
        | "outline-vermillion"
        | "solid-blue"
        | "solid-dark-blue"
        | "outline-white"
    /** Set to null to hide the icon */
    icon?: IconDefinition | null
    iconPosition?: "left" | "right"
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
    iconPosition = "right",
    dataTrackNote,
}: ButtonProps) => {
    const classes = cx("owid-btn", `owid-btn--${theme}`, className)
    const content = (
        <>
            {iconPosition === "left" && icon && (
                <FontAwesomeIcon
                    className={cx({ "owid-btn--icon-left": text })}
                    icon={icon}
                />
            )}
            {text && <span>{text}</span>}
            {iconPosition !== "left" && icon && (
                <FontAwesomeIcon
                    className={cx({ "owid-btn--icon-right": text })}
                    icon={icon}
                />
            )}
        </>
    )

    if (href) {
        const aProps = {
            href,
            className: classes,
            "data-track-note": dataTrackNote,
        }
        return <a {...aProps}>{content}</a>
    }

    const buttonProps = {
        type,
        className: classes,
        onClick,
        "aria-label": ariaLabel,
        "data-track-note": dataTrackNote,
    }
    return <button {...buttonProps}>{content}</button>
}
