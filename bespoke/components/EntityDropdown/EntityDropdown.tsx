import { ComponentProps, useMemo } from "react"

import { faLocationArrow } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { BasicDropdownOption, Dropdown, GRAY_60 } from "@ourworldindata/grapher"
import { getRegionByCode, UserCountryInformation } from "@ourworldindata/utils"
import * as R from "remeda"

import { useUserCountryInformation } from "../../hooks/useUserCountryInformation.js"
import { InlineLabeledDropdown } from "../InlineLabeledDropdown/InlineLabeledDropdown.js"

type GrapherDropdownProps = ComponentProps<typeof Dropdown<BasicDropdownOption>>
type DropdownCollection = GrapherDropdownProps["options"]

export interface EntityDropdownProps extends Omit<
    ComponentProps<typeof InlineLabeledDropdown>,
    "label" | "options" | "selectedValue"
> {
    label: string
    availableEntities: BasicDropdownOption[]
    selectedEntityName: string
}

export function EntityDropdown({
    label,
    availableEntities,
    selectedEntityName,
    ...dropdownProps
}: EntityDropdownProps): React.ReactElement {
    const { data: userCountryInfo } = useUserCountryInformation()

    const options = useMemo(
        () =>
            orderOptionsByRelevance([...availableEntities], {
                userCountryInfo,
                selectedValue: selectedEntityName,
            }),
        [availableEntities, userCountryInfo, selectedEntityName]
    )

    return (
        <InlineLabeledDropdown
            {...dropdownProps}
            label={label}
            options={options}
            selectedValue={selectedEntityName}
            isSearchable={dropdownProps.isSearchable ?? true}
        />
    )
}

/** Sortable string key for an option label. */
function labelSortKey(option: BasicDropdownOption): string {
    return typeof option.label === "string" ? option.label : option.value
}

/**
 * The location icon (matching the grapher entity selector) that marks the
 * user's country and continent.
 *
 * The dropdown menu is portaled into the light DOM, so this project's
 * shadow-scoped stylesheet can't reach it — the styling is inlined.
 */
function LocationIcon(): React.ReactElement {
    return (
        <span style={{ marginLeft: 6, color: GRAY_60 }}>
            <FontAwesomeIcon
                icon={faLocationArrow}
                style={{ fontSize: "0.9em" }}
                aria-label="Your current location"
            />
        </span>
    )
}

/**
 * Orders a flat option list into a single list:
 * any `pinnedToTop` aggregates first (in the given order), then the currently
 * selected entity, then the user's country and continental regions (income
 * groups excluded), and finally everything else sorted alphabetically.
 */
export function orderOptionsByRelevance(
    options: BasicDropdownOption[],
    {
        userCountryInfo,
        pinnedToTop = [],
        selectedValue,
    }: {
        userCountryInfo?: UserCountryInformation
        pinnedToTop?: string[]
        selectedValue?: string
    } = {}
): DropdownCollection {
    const optionsByValue = new Map(
        options.map((option) => [option.value, option])
    )

    // The user's country and continental regions (income groups excluded), in
    // country-then-continent order
    const userLocationNames = new Set<string>()
    if (userCountryInfo) {
        userLocationNames.add(userCountryInfo.name)
        for (const code of userCountryInfo.regions ?? []) {
            const region = getRegionByCode(code)

            // Ignore income groups
            if (!region || region.regionType === "income_group") continue

            userLocationNames.add(region.name)
        }
    }

    // Values to surface at the top, in priority order, with undefined dropped
    // and deduped — so a value that is e.g. both the selected entity and the
    // user's country keeps only its highest slot
    const topValues = R.pipe(
        [...pinnedToTop, selectedValue, ...userLocationNames],
        R.filter(R.isDefined),
        R.unique()
    )
    const top = topValues
        .map((value) => optionsByValue.get(value))
        .filter(R.isDefined)

    // Nothing to surface → return the flat list unchanged.
    if (top.length === 0) return options

    // Everything else, sorted alphabetically.
    const topValueSet = new Set(topValues)
    const remaining = options
        .filter((option) => !topValueSet.has(option.value))
        .sort((a, b) => labelSortKey(a).localeCompare(labelSortKey(b)))

    // Mark the user's country and continent with a location icon wherever they
    // appear — including when one of them is the selected entity.
    const withIconIfUserLocation = (
        option: BasicDropdownOption
    ): BasicDropdownOption =>
        userLocationNames.has(option.value)
            ? { ...option, label: withLocationIcon(option.label) }
            : option

    return [...top, ...remaining].map(withIconIfUserLocation)
}

/** Decorates an option label with the location icon. */
function withLocationIcon(label: React.ReactNode): React.ReactNode {
    return (
        <span>
            {label}
            <LocationIcon />
        </span>
    )
}
