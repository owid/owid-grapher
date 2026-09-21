import type { IconDefinition } from "@fortawesome/fontawesome-svg-core"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Tippy } from "@ourworldindata/utils"

/**
 * Icon-only button used by the floating site tools.
 * `label` provides both the accessible name and the tooltip text.
 * Set `tooltip={false}` for close buttons, which only need the accessible name.
 *
 * Pass `href` for a tool that navigates somewhere instead of opening a popover.
 */
export const SiteToolsButton = ({
    icon,
    label,
    tooltip = true,
    onClick,
    href,
    dataTrackNote,
}: {
    icon: IconDefinition
    label: string
    tooltip?: boolean
    onClick?: () => void
    href?: string
    dataTrackNote?: string
}) => {
    const content = <FontAwesomeIcon icon={icon} />

    const button =
        href !== undefined ? (
            <a
                aria-label={label}
                className="site-tools__button"
                data-track-note={dataTrackNote}
                href={href}
            >
                {content}
            </a>
        ) : (
            <button
                aria-label={label}
                className="site-tools__button"
                data-track-note={dataTrackNote}
                onClick={onClick}
            >
                {content}
            </button>
        )

    if (!tooltip) return button

    return (
        <Tippy
            content={label}
            theme="site-tools"
            placement="top"
            // Keeps the tooltip anchored to the button as it moves with the
            // sticky container while scrolling.
            appendTo="parent"
            delay={[200, 0]}
        >
            {button}
        </Tippy>
    )
}
