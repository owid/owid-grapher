import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
    DimensionEnriched,
    MultiDimDimensionChoices,
} from "@ourworldindata/types"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCaretDown } from "@fortawesome/free-solid-svg-icons"
import cx from "classnames"
import {
    MultiDimDataPageConfig,
    isEqual,
    mapValues,
} from "@ourworldindata/utils"
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

export const MultiDimSettingsPanel = (props: {
    config: MultiDimDataPageConfig
    currentSettings: MultiDimDimensionChoices
    updateSettings?: (currentSettings: MultiDimDimensionChoices) => void
}) => {
    const { config, currentSettings, updateSettings } = props

    const { dimensions } = config

    // Non-partial version of `currentSettings` with all dimensions filled in
    const resolvedCurrentSettings = useMemo(
        () =>
            mapValues(
                dimensions,
                (dim) =>
                    currentSettings[dim.slug] ??
                    Object.values(dim.choices)[0].slug
            ),
        [currentSettings, dimensions]
    )

    const [availableSettings, setAvailableSettings] = useState<
        Record<string, DimensionEnriched>
    >({})

    useEffect(() => {
        const { dimensionsWithAvailableChoices, selectedChoices } =
            config.filterToAvailableChoices(resolvedCurrentSettings)

        if (!isEqual(selectedChoices, resolvedCurrentSettings))
            updateSettings?.(selectedChoices)
        if (!isEqual(dimensionsWithAvailableChoices, availableSettings))
            setAvailableSettings(dimensionsWithAvailableChoices)
    }, [resolvedCurrentSettings, config, updateSettings, availableSettings])

    return (
        <div className="md-settings-row">
            <span className="h5-black-caps md-settings__configure-data">
                Configure the data
            </span>
            {Object.values(availableSettings).map((dim) => (
                <DimensionDropdown
                    key={dim.slug}
                    dimension={dim}
                    currentChoiceSlug={resolvedCurrentSettings[dim.slug]}
                    onChange={(slug, value) =>
                        updateSettings?.({
                            ...resolvedCurrentSettings,
                            [slug]: value,
                        })
                    }
                />
            ))}
        </div>
    )
}
