import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { DimensionEnriched } from "./MultiDimDataPageTypes.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCaretDown } from "@fortawesome/free-solid-svg-icons"
import cx from "classnames"
import { MultiDimDataPageConfig } from "./MultiDimDataPageConfig.js"
import { isEqual } from "@ourworldindata/utils"

const DimensionDropdown = (props: {
    dimension: DimensionEnriched
    currentChoiceSlug: string
    onChange?: (slug: string, valueSlug: string) => void
}) => {
    const { dimension } = props

    const [active, setActive] = useState(false)

    const toggleVisibility = useCallback(() => setActive(!active), [active])

    const dropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") setActive(false)
        }

        document.addEventListener("keydown", handleEscape)
        return () => document.removeEventListener("keydown", handleEscape)
    }, [])

    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if (
                active &&
                dropdownRef.current &&
                e.target instanceof Node &&
                !dropdownRef.current.contains(e.target)
            )
                setActive(false)
        }

        document.addEventListener("click", handleOutsideClick)
        return () => document.removeEventListener("click", handleOutsideClick)
    }, [active])

    const currentChoice = dimension.choicesBySlug[props.currentChoiceSlug]

    return (
        <div className="settings-dropdown" ref={dropdownRef}>
            <button
                className={cx("menu-toggle", { active })}
                onClick={toggleVisibility}
                data-track-note="multi-dim-choice-dropdown"
                type="button"
            >
                <span className="setting-label">{dimension.name}</span>
                <span className="setting-choice">{currentChoice.name}</span>
                <FontAwesomeIcon icon={faCaretDown} />
            </button>
            {active && (
                <div className="menu">
                    <div className="menu-contents">
                        <div
                            className="menu-backdrop"
                            onClick={toggleVisibility}
                        ></div>
                        {/* <OverlayHeader /> */}
                        <div className="menu-wrapper">
                            <h5 className="h5-black-caps">{dimension.name}</h5>
                            {dimension.description && (
                                <p>{dimension.description}</p>
                            )}
                            <div className="menu-options">
                                {Object.entries(dimension.choicesByGroup).map(
                                    ([groupName, groupChoices]) => (
                                        <div
                                            key={groupName}
                                            className={cx("menu-group", {
                                                "is-group":
                                                    groupName !== "undefined",
                                            })}
                                        >
                                            {groupName !== "undefined" && (
                                                <label>{groupName}</label>
                                            )}
                                            {groupChoices.map((choice) => (
                                                <section
                                                    key={choice.slug}
                                                    className={cx({
                                                        active:
                                                            choice.slug ===
                                                            props.currentChoiceSlug,
                                                    })}
                                                >
                                                    <div className="config-list">
                                                        <button
                                                            onClick={() => {
                                                                props.onChange?.(
                                                                    dimension.slug,
                                                                    choice.slug
                                                                )
                                                                setActive(false)
                                                            }}
                                                        >
                                                            {choice.name}
                                                        </button>
                                                        {choice.description && (
                                                            <label className="description">
                                                                {
                                                                    choice.description
                                                                }
                                                            </label>
                                                        )}
                                                    </div>
                                                </section>
                                            ))}
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export const MultiDimSettingsPanel = (props: {
    config: MultiDimDataPageConfig
    currentSettings: Record<string, string>
    onChange?: (
        slug: string,
        value: string,
        currentSettings: Record<string, string>
    ) => void
    updateSettings?: (currentSettings: Record<string, string>) => void
}) => {
    const { config, currentSettings, updateSettings } = props

    const { dimensions } = config

    // Non-partial version of `currentSettings` with all dimensions filled in
    const resolvedCurrentSettings = useMemo(
        () =>
            Object.fromEntries(
                Object.values(dimensions).map((dimension) => [
                    dimension.slug,
                    currentSettings[dimension.slug] ??
                        Object.values(dimension.choices)[0].slug,
                ])
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

    const settings = Object.values(availableSettings).map((dim) => (
        <DimensionDropdown
            key={dim.slug}
            dimension={dim}
            currentChoiceSlug={currentSettings[dim.slug]}
            onChange={(slug, value) =>
                updateSettings?.({ ...currentSettings, [slug]: value })
            }
        />
    ))

    return (
        <div className="settings-row">
            <span className="h5-black-caps">Configure the data</span>
            {settings}
        </div>
    )
}
