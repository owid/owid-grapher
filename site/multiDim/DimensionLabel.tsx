import { faCircleInfo } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Label } from "react-aria-components"

import { DimensionEnriched } from "@ourworldindata/types"
import { Tippy } from "@ourworldindata/utils"

// The label rendered above each dimension control (dropdown or radio group),
// with an optional info icon showing the dimension's description on hover.
// Radio groups also list the choice descriptions in the tooltip, since unlike
// dropdowns they have no menu to show them in.
export default function DimensionLabel({
    dimension,
    showChoiceDescriptions,
}: {
    dimension: DimensionEnriched
    showChoiceDescriptions?: boolean
}) {
    const choicesWithDescription = showChoiceDescriptions
        ? dimension.choices.filter((choice) => choice.description)
        : []
    const hasTooltip =
        Boolean(dimension.description) || choicesWithDescription.length > 0
    return (
        <Label className="md-settings__control-label h6-black-caps">
            {dimension.name}
            {hasTooltip && (
                <Tippy
                    content={
                        <div className="md-label-tooltip">
                            <h5 className="h6-black-caps">{dimension.name}</h5>
                            {dimension.description && (
                                <p>{dimension.description}</p>
                            )}
                            {choicesWithDescription.map((choice) => (
                                <p key={choice.slug}>
                                    <strong>{choice.name}:</strong>{" "}
                                    {choice.description}
                                </p>
                            ))}
                        </div>
                    }
                    theme="light"
                    placement="top"
                    maxWidth={296}
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
