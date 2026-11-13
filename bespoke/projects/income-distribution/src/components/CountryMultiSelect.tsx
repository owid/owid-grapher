import { useCallback, useMemo, useRef, useState } from "react"
import cx from "clsx"
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
import {
    faCheck,
    faPen,
    faTimesCircle,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

import {
    GRAPHER_BACKGROUND,
    GRAY_10,
    GRAY_30,
    GRAY_70,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"
import { Tippy } from "@ourworldindata/utils"

import { useUserCountryInformation } from "../../../../hooks/useUserCountryInformation.js"
import { MAX_SELECTED_COUNTRIES } from "../core/constants.js"
import type { WelfareType } from "../core/types.js"
import { WELFARE_TYPE_DETAILS } from "../core/welfareType.js"
import {
    WELFARE_DOD_TIPPY_PROPS,
    WelfareDetailsCard,
} from "./WelfareDetails.js"
// The popover is in the light DOM, out of reach of the shadow root's styles,
// so it brings the label cards' own (see the file's header)
import popoverCss from "./CountryMultiSelectPopover.scss?inline"

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
    /** When set, each option says after the name whether the country's data measures income or consumption */
    welfareTypeOf?: (name: string) => WelfareType
    isNarrow: boolean
}

export function CountryMultiSelect({
    availableCountries,
    selectedCountries,
    onChange,
    welfareTypeOf,
    isNarrow,
}: CountryMultiSelectProps): React.ReactElement {
    const [isOpen, setIsOpen] = useState(false)
    // The labels' cards mount inside the popover, next to its <style>
    const popoverRef = useRef<HTMLElement>(null)
    const getPopover = useCallback(
        (): Element => popoverRef.current ?? document.body,
        []
    )
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
            {/* Mirrors Grapher's "Edit countries and regions" toggle
                (button.menu-toggle in EntitySelectionToggle) */}
            <Button
                className={({ isPressed }) =>
                    cx("income-distribution-edit-countries", {
                        "income-distribution-edit-countries--active":
                            isOpen || isPressed,
                    })
                }
                aria-label={
                    selectedCountries.length > 0
                        ? `Edit countries. Selected: ${selectedCountries.join(", ")}`
                        : "Edit countries"
                }
            >
                <FontAwesomeIcon icon={faPen} aria-hidden />
                Edit countries
            </Button>
            <Popover
                ref={popoverRef}
                className="grapher-dropdown-menu"
                placement="bottom end"
                // Wider with the welfare type, so long names keep to one line
                style={{ minWidth: welfareTypeOf ? 320 : 240 }}
            >
                {welfareTypeOf && <style>{popoverCss}</style>}
                <CountryListBox
                    availableCountries={availableCountries}
                    selectedCountries={selectedCountries}
                    pinnedCountries={pinnedCountries}
                    onChange={onChange}
                    welfareTypeOf={welfareTypeOf}
                    getPopover={getPopover}
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
    welfareTypeOf,
    getPopover,
    maxHeight,
}: {
    availableCountries: string[]
    selectedCountries: string[]
    pinnedCountries: string[]
    onChange: (names: string[]) => void
    welfareTypeOf?: (name: string) => WelfareType
    getPopover: () => Element
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
    // At the cap, the rest can't be picked until one is removed
    const isFull = selectedCountries.length >= MAX_SELECTED_COUNTRIES
    const disabledKeys = useMemo(
        () =>
            isFull
                ? new Set(
                      availableCountries.filter(
                          (name) => !selectedKeys.has(name)
                      )
                  )
                : undefined,
        [isFull, availableCountries, selectedKeys]
    )

    const handleSelectionChange = useCallback(
        (keys: Selection) => {
            if (keys === "all") {
                onChange(availableCountries.slice(0, MAX_SELECTED_COUNTRIES))
                return
            }
            const next = new Set(
                [...keys].filter((key) => typeof key === "string")
            )
            // Keep the existing order and append new picks at the end
            const kept = selectedCountries.filter((name) => next.has(name))
            const keptSet = new Set(kept)
            const added = [...next].filter((name) => !keptSet.has(name))
            onChange([...kept, ...added].slice(0, MAX_SELECTED_COUNTRIES))
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
            {isFull && (
                <div
                    role="status"
                    style={{
                        padding: "8px 16px",
                        borderBottom: `1px solid ${GRAY_10}`,
                        color: GRAY_70,
                        fontSize: 12,
                    }}
                >
                    You can select up to {MAX_SELECTED_COUNTRIES} countries.
                    Remove one to add another.
                </div>
            )}
            <ListBox
                className="grapher-dropdown-listbox"
                aria-label="Countries"
                selectionMode="multiple"
                selectedKeys={selectedKeys}
                disabledKeys={disabledKeys}
                onSelectionChange={handleSelectionChange}
                style={{ maxHeight }}
            >
                {orderedCountries.map((name) => (
                    <ListBoxItem
                        key={name}
                        id={name}
                        textValue={name}
                        style={({ isHovered, isFocused, isDisabled }) => ({
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 16px",
                            cursor: isDisabled ? "default" : "pointer",
                            opacity: isDisabled ? 0.45 : undefined,
                            outline: "none",
                            background:
                                (isHovered || isFocused) && !isDisabled
                                    ? OPTION_HOVER_FILL
                                    : undefined,
                        })}
                    >
                        {({ isSelected }) => (
                            <>
                                <CheckboxIndicator isSelected={isSelected} />
                                <span style={{ flex: "1 1 auto" }}>{name}</span>
                                {welfareTypeOf && (
                                    <WelfareTypeLabel
                                        welfareType={welfareTypeOf(name)}
                                        getPopover={getPopover}
                                    />
                                )}
                            </>
                        )}
                    </ListBoxItem>
                ))}
            </ListBox>
        </Autocomplete>
    )
}

/**
 * "Income data" or "Consumption data" after a country's name, with its
 * details-on-demand card on hover. Not focusable, as the option is; a click
 * on it toggles the option like the rest of the row, and hovering it doesn't.
 */
function WelfareTypeLabel({
    welfareType,
    getPopover,
}: {
    welfareType: WelfareType
    getPopover: () => Element
}): React.ReactElement {
    return (
        <Tippy
            {...WELFARE_DOD_TIPPY_PROPS}
            // Inside the list, where a card the pointer can enter would
            // linger over the options below
            interactive={false}
            delay={[150, 0]}
            // Below the label (above it near the list's end), narrow enough
            // to fit the popover, which clips what overflows it
            placement="bottom-end"
            maxWidth={280}
            content={<WelfareDetailsCard welfareType={welfareType} />}
            appendTo={getPopover}
        >
            <span
                style={{
                    flex: "0 0 auto",
                    marginLeft: 8,
                    color: GRAY_70,
                    fontSize: 12,
                    // As .dod-span (see WelfareDetails.scss)
                    textDecoration: "underline dotted",
                    textUnderlineOffset: 2,
                    cursor: "help",
                }}
            >
                {WELFARE_TYPE_DETAILS[welfareType].title}
            </span>
        </Tippy>
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
