import { faCircleInfo } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Label } from "react-aria-components"

import { Tippy } from "@ourworldindata/utils"

// The label rendered above each dimension control (dropdown or radio group),
// with an optional info icon showing the dimension's description on hover.
export default function DimensionLabel({
    name,
    description,
}: {
    name: string
    description?: string
}) {
    return (
        <Label className="md-settings__control-label h6-black-caps">
            {name}
            {description && (
                <Tippy
                    content={description}
                    theme="light"
                    placement="top"
                    appendTo={() => document.body}
                >
                    <span
                        className="md-settings__control-label-icon"
                        tabIndex={0}
                    >
                        <FontAwesomeIcon icon={faCircleInfo} />
                    </span>
                </Tippy>
            )}
        </Label>
    )
}
