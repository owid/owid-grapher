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
    iconNowrap?: boolean
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
    iconNowrap = true,
    dataTrackNote,
}: ButtonProps) => {
    const classes = cx("owid-btn", `owid-btn--${theme}`, className)

    const words = text.trim().split(" ")
    let neighborWord
    if (icon && iconNowrap) {
        neighborWord = iconPosition === "left" ? words.shift() : words.pop()
    }
    const rest = words.join(" ")

    const content = (
        <>
            {iconPosition === "left" && icon && (
                <span className={cx({ "whitespace-nowrap": iconNowrap })}>
                    <FontAwesomeIcon
                        className={cx({ "owid-btn--icon-left": text })}
                        icon={icon}
                    />
                    {neighborWord && (
                        <span>{neighborWord + (rest ? " " : "")}</span>
                    )}
                </span>
            )}
            {rest && <span>{rest}</span>}
            {iconPosition !== "left" && icon && (
                <span className={cx({ "whitespace-nowrap": iconNowrap })}>
                    {neighborWord && (
                        <span>{(rest ? " " : "") + neighborWord}</span>
                    )}
                    <FontAwesomeIcon
                        className={cx({ "owid-btn--icon-right": text })}
                        icon={icon}
                    />
                </span>
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
