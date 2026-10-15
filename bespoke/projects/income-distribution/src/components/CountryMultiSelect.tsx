import { useCallback, useMemo, useState } from "react"
import * as R from "remeda"
import {
    Autocomplete,
    Button,
    DialogTrigger,
    Input,
    ListBox,
    ListBoxItem,
    Popover,
    SearchField,
    Selection,
    useFilter,
} from "react-aria-components"
import { faCheck, faTimesCircle } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

import {
    GRAPHER_BACKGROUND,
    GRAY_10,
    GRAY_30,
    GRAY_70,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"

import { useUserCountryInformation } from "../../../../hooks/useUserCountryInformation.js"

// The popover portals into the light DOM, where none of this bundle's styles
// reach, so everything inside it is either a global grapher-dropdown class or
// inline. The checkbox mirrors the colours of Grapher's Checkbox.scss.
const CHECKBOX_SIZE = 16
const CHECKBOX_STROKE = GRAY_30
const CHECKBOX_CHECKED_FILL = "#a4b6ca" // $blue-30, no TS constant exists
const OPTION_HOVER_FILL = GRAY_10

export interface CountryMultiSelectProps {
    availableCountries: string[]
    selectedCountries: string[]
    onChange: (names: string[]) => void
    isNarrow: boolean
}

export function CountryMultiSelect({
    availableCountries,
    selectedCountries,
    onChange,
    isNarrow,
}: CountryMultiSelectProps): React.ReactElement {
    const [isOpen, setIsOpen] = useState(false)
    // The selection as it was when the menu opened, pinned to the top so the
    // reader sees what's selected without options jumping while they toggle
    const [pinnedCountries, setPinnedCountries] =
        useState<string[]>(selectedCountries)

    const handleOpenChange = useCallback(
        (open: boolean) => {
            if (open) setPinnedCountries(selectedCountries)
            setIsOpen(open)
        },
        [selectedCountries]
    )

    return (
        <DialogTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
            <div className="grapher-dropdown income-distribution-country-multi-select">
                <Button
                    className="control income-distribution-country-multi-select__trigger"
                    // The visible label abbreviates long selections
                    aria-label={
                        selectedCountries.length > 0
                            ? `Selected countries: ${selectedCountries.join(", ")}`
                            : "Select countries"
                    }
                >
                    <span
                        className="select-value"
                        data-placeholder={
                            selectedCountries.length === 0 ? true : undefined
                        }
                    >
                        {triggerLabel(selectedCountries)}
                    </span>
                </Button>
            </div>
            <Popover
                className="grapher-dropdown-menu"
                placement="bottom start"
                style={{ minWidth: 240 }}
            >
                <CountryListBox
                    availableCountries={availableCountries}
                    selectedCountries={selectedCountries}
                    pinnedCountries={pinnedCountries}
                    onChange={onChange}
                    maxHeight={isNarrow ? 280 : 400}
                />
            </Popover>
        </DialogTrigger>
    )
}

function CountryListBox({
    availableCountries,
    selectedCountries,
    pinnedCountries,
    onChange,
    maxHeight,
}: {
    availableCountries: string[]
    selectedCountries: string[]
    pinnedCountries: string[]
    onChange: (names: string[]) => void
    maxHeight: number
}): React.ReactElement {
    const { data: userCountryInfo } = useUserCountryInformation()
    const { contains } = useFilter({ sensitivity: "base" })

    const orderedCountries = useMemo(() => {
        const available = new Set(availableCountries)
        const top = R.pipe(
            [
                userCountryInfo?.name,
                ...pinnedCountries.toSorted((a, b) => a.localeCompare(b, "en")),
            ],
            R.filter(R.isDefined),
            R.filter((name) => available.has(name)),
            R.unique()
        )
        const topSet = new Set(top)
        return [
            ...top,
            ...availableCountries.filter((name) => !topSet.has(name)),
        ]
    }, [availableCountries, pinnedCountries, userCountryInfo?.name])

    const selectedKeys = useMemo(
        () => new Set(selectedCountries),
        [selectedCountries]
    )

    const handleSelectionChange = useCallback(
        (keys: Selection) => {
            if (keys === "all") {
                onChange(availableCountries)
                return
            }
            const next = new Set(
                [...keys].filter((key) => typeof key === "string")
            )
            // Keep the existing order and append new picks at the end
            const kept = selectedCountries.filter((name) => next.has(name))
            const keptSet = new Set(kept)
            const added = [...next].filter((name) => !keptSet.has(name))
            onChange([...kept, ...added])
        },
        [availableCountries, selectedCountries, onChange]
    )

    return (
        <Autocomplete filter={contains}>
            <SearchField
                className="grapher-dropdown-search"
                aria-label="Search countries"
                autoFocus
            >
                <span className="grapher-dropdown-search-icon" />
                <Input
                    className="grapher-dropdown-search-input"
                    placeholder="Search..."
                />
                <Button className="grapher-dropdown-search-reset">
                    <FontAwesomeIcon icon={faTimesCircle} aria-hidden />
                </Button>
            </SearchField>
            {selectedCountries.length > 0 && (
                <Button
                    onPress={() => onChange([])}
                    style={({ isHovered, isFocusVisible }) => ({
                        display: "block",
                        width: "100%",
                        padding: "8px 16px",
                        border: "none",
                        borderBottom: `1px solid ${GRAY_10}`,
                        background:
                            isHovered || isFocusVisible
                                ? OPTION_HOVER_FILL
                                : "none",
                        color: GRAY_70,
                        font: "inherit",
                        textAlign: "left",
                        cursor: "pointer",
                        outline: "none",
                    })}
                >
                    Clear selection
                </Button>
            )}
            <ListBox
                className="grapher-dropdown-listbox"
                aria-label="Countries"
                selectionMode="multiple"
                selectedKeys={selectedKeys}
                onSelectionChange={handleSelectionChange}
                style={{ maxHeight }}
            >
                {orderedCountries.map((name) => (
                    <ListBoxItem
                        key={name}
                        id={name}
                        textValue={name}
                        style={({ isHovered, isFocused }) => ({
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 16px",
                            cursor: "pointer",
                            outline: "none",
                            background:
                                isHovered || isFocused
                                    ? OPTION_HOVER_FILL
                                    : undefined,
                        })}
                    >
                        {({ isSelected }) => (
                            <>
                                <CheckboxIndicator isSelected={isSelected} />
                                {name}
                            </>
                        )}
                    </ListBoxItem>
                ))}
            </ListBox>
        </Autocomplete>
    )
}

function CheckboxIndicator({
    isSelected,
}: {
    isSelected: boolean
}): React.ReactElement {
    return (
        <span
            aria-hidden
            style={{
                flex: "0 0 auto",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                boxSizing: "border-box",
                width: CHECKBOX_SIZE,
                height: CHECKBOX_SIZE,
                borderRadius: 2,
                border: `1px solid ${isSelected ? CHECKBOX_CHECKED_FILL : CHECKBOX_STROKE}`,
                background: isSelected
                    ? CHECKBOX_CHECKED_FILL
                    : GRAPHER_BACKGROUND,
                color: GRAPHER_BACKGROUND,
                fontSize: 10,
            }}
        >
            {isSelected && <FontAwesomeIcon icon={faCheck} />}
        </span>
    )
}

function triggerLabel(selectedCountries: string[]): string {
    if (selectedCountries.length === 0) return "Select countries…"
    if (selectedCountries.length <= 2) return selectedCountries.join(", ")
    return `${selectedCountries.length} countries selected`
}
