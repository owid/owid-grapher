import { useCallback, useId, useMemo, useState } from "react"
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
import { faTimesCircle } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

import {
    GRAPHER_BACKGROUND,
    GRAY_10,
    GRAY_20,
    GRAY_70,
    GRAY_90,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"

import {
    INTERNATIONAL_DOLLAR,
    TIME_INTERVAL_LABELS,
} from "../core/constants.js"
import {
    currencyKey,
    formatCurrencyLabel,
    timeIntervalNoun,
} from "../core/currency.js"
import { Currency, TIME_INTERVALS, TimeInterval } from "../core/types.js"

// The popover portals into the light DOM, where none of this bundle's styles
// reach, so everything inside it is either a global grapher-dropdown class or
// inline (as in CountryMultiSelect.tsx). No TS constants exist for these.
const ACTIVE_TEXT = "#1d3d63" // $blue-90
const ACTIVE_FILL = "#dbe5f0" // $blue-20

type CurrencyChoice = "international" | "suggested" | "other"

export interface IncomeUnitPickerProps {
    currency: Currency
    /** Takes a country code (see `currencyKey` in core/currency.ts) or INTERNATIONAL_DOLLAR.code */
    setCurrency: (key: string) => void
    /** Undefined while loading or when the conversions failed to load */
    currencies: Currency[] | undefined
    /** The reader's local currency, if known */
    suggestedCurrency?: Currency
    timeInterval: TimeInterval
    setTimeInterval: (interval: TimeInterval) => void
    isNarrow: boolean
}

/**
 * One control for both the currency and the time unit. Most readers want
 * international-$ or their own currency, so those are the first two choices;
 * any other country's currency sits behind "Other currency", with a search.
 */
export function IncomeUnitPicker({
    currency,
    setCurrency,
    currencies,
    suggestedCurrency,
    timeInterval,
    setTimeInterval,
    isNarrow,
}: IncomeUnitPickerProps): React.ReactElement {
    const [isOpen, setIsOpen] = useState(false)
    // The popover sits in the light DOM, so its ids and the radio group's
    // name must be unique across the whole page
    const id = useId()
    const introId = `${id}-intro`
    const radioName = `${id}-currency`

    const selectedChoice = currencyChoice(currency, suggestedCurrency)
    // "Other" can be picked before a currency from the list is; the list then
    // shows without changing the chart yet
    const [isOtherExpanded, setIsOtherExpanded] = useState(
        selectedChoice === "other"
    )
    const visibleChoice: CurrencyChoice =
        isOtherExpanded && selectedChoice !== "other" ? "other" : selectedChoice

    const handleOpenChange = useCallback(
        (open: boolean) => {
            if (open) setIsOtherExpanded(selectedChoice === "other")
            setIsOpen(open)
        },
        [selectedChoice]
    )

    const chooseCurrency = (choice: CurrencyChoice): void => {
        setIsOtherExpanded(choice === "other")
        if (choice === "international") setCurrency(INTERNATIONAL_DOLLAR.code)
        if (choice === "suggested" && suggestedCurrency)
            setCurrency(currencyKey(suggestedCurrency))
    }

    const label = `${formatCurrencyLabel(currency)}, per ${timeIntervalNoun(timeInterval)}`

    return (
        <DialogTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
            <div className="grapher-dropdown income-distribution-unit-picker">
                <Button
                    className="control"
                    aria-label={`Measured in ${label}. Change currency or time unit`}
                >
                    <span className="select-value">{label}</span>
                </Button>
            </div>
            <Popover
                className="grapher-dropdown-menu"
                placement="bottom start"
                style={{ width: isNarrow ? 290 : 350, overflowY: "auto" }}
            >
                <div style={{ padding: "4px 0 8px" }}>
                    <div className="group-heading">Currency &amp; prices</div>
                    <div
                        id={introId}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            margin: "2px 8px 8px",
                            fontSize: 12,
                            lineHeight: 1.4,
                            color: GRAY_70,
                        }}
                    >
                        <p style={{ margin: 0 }}>
                            To compare incomes across countries, we convert them
                            to a single currency, adjusting for price
                            differences.
                        </p>
                        <p style={{ margin: 0 }}>Convert to:</p>
                    </div>
                    <div
                        role="radiogroup"
                        aria-label="Currency and price level"
                        aria-describedby={introId}
                    >
                        <ChoiceRow
                            name={radioName}
                            checked={visibleChoice === "international"}
                            onSelect={() => chooseCurrency("international")}
                            label={formatCurrencyLabel(INTERNATIONAL_DOLLAR)}
                            detail="Expressed in terms of the currency and price level of the United States"
                        />
                        {suggestedCurrency && (
                            <ChoiceRow
                                name={radioName}
                                checked={visibleChoice === "suggested"}
                                onSelect={() => chooseCurrency("suggested")}
                                label={formatCurrencyLabel(suggestedCurrency)}
                                detail="Expressed in terms of your local currency and price level"
                            />
                        )}
                        <ChoiceRow
                            name={radioName}
                            checked={visibleChoice === "other"}
                            onSelect={() => chooseCurrency("other")}
                            label="Other currency"
                            detail="Select another country's currency and price level"
                        />
                    </div>
                    {visibleChoice === "other" && (
                        <OtherCurrencyList
                            currencies={currencies}
                            // Also highlights the reader's own currency when
                            // it was picked from the list
                            selectedKey={
                                selectedChoice === "international"
                                    ? undefined
                                    : currencyKey(currency)
                            }
                            onSelect={setCurrency}
                            maxHeight={isNarrow ? 180 : 240}
                        />
                    )}
                    <div
                        style={{
                            margin: "8px 8px 0",
                            borderTop: `1px solid ${GRAY_10}`,
                        }}
                    />
                    <div className="group-heading">Income per</div>
                    <TimeIntervalSegments
                        timeInterval={timeInterval}
                        setTimeInterval={setTimeInterval}
                    />
                </div>
            </Popover>
        </DialogTrigger>
    )
}

function currencyChoice(
    currency: Currency,
    suggestedCurrency: Currency | undefined
): CurrencyChoice {
    if (currency.code === INTERNATIONAL_DOLLAR.code) return "international"
    if (
        suggestedCurrency?.countryCode &&
        currency.countryCode === suggestedCurrency.countryCode
    )
        return "suggested"
    return "other"
}

function ChoiceRow({
    name,
    checked,
    onSelect,
    label,
    detail,
}: {
    name: string
    checked: boolean
    onSelect: () => void
    label: string
    detail?: string
}): React.ReactElement {
    const [isHovered, setIsHovered] = useState(false)
    return (
        <label
            onPointerEnter={() => setIsHovered(true)}
            onPointerLeave={() => setIsHovered(false)}
            style={{
                display: "grid",
                gridTemplateColumns: "16px minmax(0, 1fr)",
                gap: 10,
                alignItems: "start",
                padding: "8px 16px",
                cursor: "pointer",
                background: checked
                    ? ACTIVE_FILL
                    : isHovered
                      ? GRAY_10
                      : undefined,
                color: checked ? ACTIVE_TEXT : GRAY_90,
            }}
        >
            <input
                type="radio"
                name={name}
                checked={checked}
                onChange={onSelect}
                style={{ margin: "1px 0 0", accentColor: ACTIVE_TEXT }}
            />
            <span>
                <span style={{ display: "block" }}>{label}</span>
                {detail && (
                    <span
                        style={{
                            display: "block",
                            marginTop: 2,
                            fontSize: 12,
                            color: GRAY_70,
                        }}
                    >
                        {detail}
                    </span>
                )}
            </span>
        </label>
    )
}

function OtherCurrencyList({
    currencies,
    selectedKey,
    onSelect,
    maxHeight,
}: {
    currencies: Currency[] | undefined
    selectedKey: string | undefined
    onSelect: (key: string) => void
    maxHeight: number
}): React.ReactElement {
    const { contains } = useFilter({ sensitivity: "base" })
    const options = useMemo(
        () =>
            (currencies ?? []).map((c) => ({
                key: currencyKey(c),
                label: formatCurrencyLabel(c),
            })),
        [currencies]
    )
    const selectedKeys = useMemo(
        () => new Set(selectedKey ? [selectedKey] : []),
        [selectedKey]
    )
    const handleSelectionChange = useCallback(
        (keys: Selection) => {
            if (keys === "all") return
            const [key] = [...keys]
            if (typeof key === "string") onSelect(key)
        },
        [onSelect]
    )

    if (currencies === undefined)
        return (
            <div style={{ padding: "8px 16px 8px 42px", color: GRAY_70 }}>
                Loading currencies…
            </div>
        )

    return (
        <div style={{ margin: "4px 8px 0 34px" }}>
            <Autocomplete filter={contains}>
                <SearchField
                    className="grapher-dropdown-search"
                    aria-label="Search currencies"
                    autoFocus
                    style={{ margin: "0 0 4px" }}
                >
                    <span className="grapher-dropdown-search-icon" />
                    <Input
                        className="grapher-dropdown-search-input"
                        placeholder="Search by country or currency…"
                    />
                    <Button className="grapher-dropdown-search-reset">
                        <FontAwesomeIcon icon={faTimesCircle} aria-hidden />
                    </Button>
                </SearchField>
                <ListBox
                    className="grapher-dropdown-listbox"
                    aria-label="Currencies"
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={selectedKeys}
                    onSelectionChange={handleSelectionChange}
                    renderEmptyState={() => (
                        <div style={{ padding: "7px 12px", color: GRAY_70 }}>
                            No currencies found
                        </div>
                    )}
                    style={{
                        maxHeight,
                        border: `1px solid ${GRAY_20}`,
                        borderRadius: 4,
                    }}
                >
                    {options.map((option) => (
                        <ListBoxItem
                            key={option.key}
                            id={option.key}
                            textValue={option.label}
                            style={({ isHovered, isFocused, isSelected }) => ({
                                padding: "7px 12px",
                                cursor: "pointer",
                                outline: "none",
                                color: isSelected ? ACTIVE_TEXT : undefined,
                                background: isSelected
                                    ? ACTIVE_FILL
                                    : isHovered || isFocused
                                      ? GRAY_10
                                      : undefined,
                            })}
                        >
                            {option.label}
                        </ListBoxItem>
                    ))}
                </ListBox>
            </Autocomplete>
        </div>
    )
}

/** Day / Month / Year, styled like the bespoke Switcher */
function TimeIntervalSegments({
    timeInterval,
    setTimeInterval,
}: {
    timeInterval: TimeInterval
    setTimeInterval: (interval: TimeInterval) => void
}): React.ReactElement {
    return (
        <div
            role="radiogroup"
            aria-label="Income per"
            style={{
                display: "flex",
                margin: "0 16px",
                padding: 2,
                border: `1px solid ${GRAY_20}`,
                borderRadius: 4,
                background: GRAPHER_BACKGROUND,
            }}
        >
            {TIME_INTERVALS.map((interval) => (
                <TimeIntervalSegment
                    key={interval}
                    label={TIME_INTERVAL_LABELS[interval]}
                    checked={interval === timeInterval}
                    onSelect={() => setTimeInterval(interval)}
                />
            ))}
        </div>
    )
}

function TimeIntervalSegment({
    label,
    checked,
    onSelect,
}: {
    label: string
    checked: boolean
    onSelect: () => void
}): React.ReactElement {
    // Inline because the popover lives in the light DOM; mirrors the
    // Switcher's hovered state
    const [isHovered, setIsHovered] = useState(false)
    return (
        <button
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={onSelect}
            onPointerEnter={() => setIsHovered(true)}
            onPointerLeave={() => setIsHovered(false)}
            style={{
                flex: 1,
                height: 28,
                border: "none",
                borderRadius: 3,
                background: checked
                    ? ACTIVE_FILL
                    : isHovered
                      ? GRAY_10
                      : "none",
                color: checked ? ACTIVE_TEXT : GRAY_90,
                font: "inherit",
                cursor: "pointer",
            }}
        >
            {label}
        </button>
    )
}
