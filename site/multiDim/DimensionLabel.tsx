import { faCircleInfo } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Label } from "react-aria-components"

import { DimensionEnriched } from "@ourworldindata/types"
import { Tippy } from "@ourworldindata/utils"

// The label rendered above each dimension control, with an optional info icon
// showing the dimension's description on hover.
//
// The icon sits next to the `Label` rather than inside it: React Aria focuses
// the select trigger when its label is clicked, which would pull focus off the
// icon and dismiss the tooltip on touch devices.
export default function DimensionLabel({
    dimension,
}: {
    dimension: DimensionEnriched
}) {
    return (
        <div className="md-settings__control-label">
            <Label className="h6-black-caps">{dimension.name}</Label>
            {dimension.description && (
                <Tippy
                    content={
                        <div className="md-label-tooltip note-1-regular">
                            <h5 className="h6-black-caps">{dimension.name}</h5>
                            <p>{dimension.description}</p>
                        </div>
                    }
                    theme="light"
                    placement="top"
                    maxWidth={296}
                    appendTo={() => document.body}
                >
                    <span
                        className="md-settings__control-label-icon"
                        // A focusable element needs a role and a name, or
                        // screen readers land on something unlabelled.
                        role="button"
                        aria-label={`About ${dimension.name}`}
                        tabIndex={0}
                    >
                        <FontAwesomeIcon icon={faCircleInfo} />
                    </span>
                </Tippy>
            )}
        </div>
    )
}
