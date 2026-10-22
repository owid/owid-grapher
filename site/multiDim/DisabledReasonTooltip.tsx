import { ReactElement } from "react"

import { Tippy } from "@ourworldindata/utils"

// Controls and options are only ever disabled because there's no view for
// them with the other current selections, so a generic reason covers all
// cases.
export const UNAVAILABLE_OPTION_REASON =
    "This option isn't available for the currently selected chart view, and therefore can't be selected."
export const DISABLED_CONTROL_REASON =
    "These options aren't available for the currently selected chart view, and therefore can't be changed."

// Explains on hover why a control or option can't be used. Without a
// `reason` (i.e. while it's usable) the tooltip is switched off, but the
// children stay mounted, so availability changes don't remount them.
export default function DisabledReasonTooltip({
    reason,
    children,
}: {
    reason?: string
    children: ReactElement
}) {
    return (
        <Tippy
            content={
                <span className="md-disabled-tooltip note-1-regular">
                    {reason}
                </span>
            }
            disabled={!reason}
            // Only after a short hover, so it doesn't flash up while the
            // pointer just passes over.
            delay={[300, 0]}
            placement="top"
            appendTo={() => document.body}
        >
            {children}
        </Tippy>
    )
}
