import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { IconDefinition, faArrowRight } from "@fortawesome/free-solid-svg-icons"

type ButtonCommonProps = {
    text?: string
    className?: string
    style?: React.CSSProperties
    theme:
        | "solid-vermillion"
        | "solid-blue"
        | "solid-dark-blue"
        | "solid-light-blue"
        | "outline-vermillion"
        | "outline-light-blue"
        | "outline-white"
    /** Set to null to hide the icon */
    icon?: IconDefinition | null
    iconPosition?: "left" | "right"
    dataTrackNote?: string
    disabled?: boolean
    ariaLabel?: string
}

type WithHrefProps = {
    href: string
    onClick?: never
    type?: never
}

type WithOnClickProps = {
    onClick?: () => void
    href?: never
    type?: "button" | "submit"
}

export type ButtonProps =
    | (ButtonCommonProps & WithHrefProps)
    | (ButtonCommonProps & WithOnClickProps)

export const Button = ({
    theme = "solid-vermillion",
    className,
    style,
    href,
    onClick,
    text,
    ariaLabel,
    type = "button",
    icon = faArrowRight,
    iconPosition = "right",
    dataTrackNote,
    disabled,
}: ButtonProps) => {
    const classes = cx("owid-btn", `owid-btn--${theme}`, className, {
        "owid-btn--icon-only": icon && !text,
    })
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
            href: disabled ? undefined : href,
            className: classes,
            style,
            "data-track-note": dataTrackNote,
            onClick: disabled
                ? (e: React.MouseEvent) => e.preventDefault()
                : undefined,
            "aria-label": ariaLabel,
            "aria-disabled": disabled,
        }
        return <a {...aProps}>{content}</a>
    }

    const buttonProps = {
        type,
        className: classes,
        style,
        onClick,
        "aria-label": ariaLabel,
        "data-track-note": dataTrackNote,
        disabled,
    }
    return <button {...buttonProps}>{content}</button>
}
