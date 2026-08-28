import type { IconDefinition } from "@fortawesome/fontawesome-svg-core"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Tippy } from "@ourworldindata/utils"

/**
 * Icon-only button used by the floating site tools (newsletter subscription,
 * feedback). The label is only shown in a tooltip on hover/focus, so that the
 * buttons stay small enough to be permanently visible without covering the
 * content underneath them.
 *
 * Pass `href` for a tool that navigates somewhere instead of opening a popover.
 */
export const SiteToolsButton = ({
    icon,
    label,
    onClick,
    href,
    dataTrackNote,
}: {
    icon: IconDefinition
    label: string
    onClick?: () => void
    href?: string
    dataTrackNote?: string
}) => {
    const content = <FontAwesomeIcon icon={icon} />

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
            {href !== undefined ? (
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
            )}
        </Tippy>
    )
}
