import { useCallback, useMemo, useRef, useState } from "react"
import {
    DimensionEnriched,
    MultiDimDimensionChoices,
} from "@ourworldindata/types"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCaretDown } from "@fortawesome/free-solid-svg-icons"
import cx from "classnames"
import { MultiDimDataPageConfig, mapValues } from "@ourworldindata/utils"
import { OverlayHeader, RadioButton } from "@ourworldindata/components"
import { useTriggerOnEscape, useTriggerWhenClickOutside } from "../hooks.js"

const DimensionDropdown = (props: {
    dimension: DimensionEnriched
    currentChoiceSlug: string
    onChange?: (slug: string, valueSlug: string) => void
}) => {
    const { dimension } = props

    const [active, setActive] = useState(false)

    const toggleVisibility = useCallback(() => setActive(!active), [active])
    const hide = useCallback(() => setActive(false), [])

    const dropdownRef = useRef<HTMLDivElement>(null)

    useTriggerOnEscape(hide)
    useTriggerWhenClickOutside(dropdownRef, active, hide)

    const currentChoice = dimension.choicesBySlug[props.currentChoiceSlug]
    if (currentChoice === undefined)
        throw new Error(
            `Unexpected error: Invalid choice slug ${props.currentChoiceSlug} for dimension ${dimension.slug}`
        )

    return (
        <div className="md-settings__dropdown" ref={dropdownRef}>
            <button
                className={cx("md-settings__dropdown-toggle", { active })}
                onClick={toggleVisibility}
                data-track-note="multi-dim-choice-dropdown"
                type="button"
            >
                <span className="md-settings__dropdown-label">
                    {dimension.name}
                </span>
                <span className="md-settings__dropdown-current-choice">
                    {currentChoice.name}
                </span>
                <FontAwesomeIcon icon={faCaretDown} />
            </button>
            {active && (
                <div className="md-menu">
                    <OverlayHeader title={dimension.name} onDismiss={hide} />
                    {dimension.description && (
                        <p className="md-description menu-dimension__description">
                            {dimension.description}
                        </p>
                    )}
                    <div className="md-menu__options">
                        {Object.entries(dimension.choicesByGroup).map(
                            ([groupLabel, groupChoices]) => (
                                <div
                                    key={groupLabel}
                                    className={cx("md-menu__group", {
                                        "is-group": groupLabel !== "undefined",
                                    })}
                                >
                                    {groupLabel !== "undefined" && (
                                        <label className="md-menu__group-label">
                                            {groupLabel}
                                        </label>
                                    )}
                                    <div className="md-menu__group-options">
                                        {groupChoices.map((choice) => (
                                            <div
                                                className="md-menu__radio-button"
                                                key={choice.slug}
                                            >
                                                <RadioButton
                                                    checked={
                                                        choice.slug ===
                                                        props.currentChoiceSlug
                                                    }
                                                    label={
                                                        <>
                                                            <div>
                                                                {choice.name}
                                                            </div>
                                                            {choice.description && (
                                                                <label className="md-description">
                                                                    {
                                                                        choice.description
                                                                    }
                                                                </label>
                                                            )}
                                                        </>
                                                    }
                                                    onChange={() =>
                                                        props.onChange?.(
                                                            dimension.slug,
                                                            choice.slug
                                                        )
                                                    }
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export const MultiDimSettingsPanel = ({
    className,
    config,
    settings,
    onChange,
}: {
    className?: string
    config: MultiDimDataPageConfig
    settings: MultiDimDimensionChoices
    onChange: (settings: MultiDimDimensionChoices) => void
}) => {
    const { dimensions } = config

    // Non-partial version of `settings` with all dimensions filled in
    const resolvedSettings = useMemo(
        () =>
            mapValues(
                dimensions,
                (dim) =>
                    settings[dim.slug] ?? Object.values(dim.choices)[0].slug
            ),
        [settings, dimensions]
    )

    const availableSettings = useMemo(() => {
        return config.filterToAvailableChoices(resolvedSettings)
            .dimensionsWithAvailableChoices
    }, [resolvedSettings, config])

    return (
        <div className={cx("md-settings-row", className)}>
            <div className="h5-black-caps md-settings__configure-data">
                Configure the data
            </div>
            <div className="md-settings__dropdowns">
                {Object.values(availableSettings).map((dim) => (
                    <DimensionDropdown
                        key={dim.slug}
                        dimension={dim}
                        currentChoiceSlug={resolvedSettings[dim.slug]}
                        onChange={(slug, value) =>
                            onChange({
                                ...resolvedSettings,
                                [slug]: value,
                            })
                        }
                    />
                ))}
            </div>
        </div>
    )
}
