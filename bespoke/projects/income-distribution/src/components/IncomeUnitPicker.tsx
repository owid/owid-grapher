import { useCallback, useId, useMemo, useState } from "react"
import cx from "clsx"
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
    Switcher,
    SwitcherItem,
} from "../../../../components/Switcher/Switcher.js"

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
// The popover portals into the light DOM, out of reach of the bundle's
// shadow-root styles, so it brings its own (see the file's header)
import popoverCss from "./IncomeUnitPickerPopover.scss?inline"

const TIME_INTERVAL_ITEMS: SwitcherItem<TimeInterval>[] = TIME_INTERVALS.map(
    (interval) => ({ key: interval, element: TIME_INTERVAL_LABELS[interval] })
)

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
                className={cx(
                    "grapher-dropdown-menu",
                    "income-distribution-unit-picker__popover",
                    isNarrow &&
                        "income-distribution-unit-picker__popover--narrow"
                )}
                placement="bottom start"
            >
                <style>{popoverCss}</style>
                <div className="income-distribution-unit-picker__panel">
                    <div className="group-heading">Currency &amp; prices</div>
                    <div
                        id={introId}
                        className="income-distribution-unit-picker__intro"
                    >
                        <p>
                            To compare incomes across countries, we convert them
                            to a single currency, adjusting for price
                            differences.
                        </p>
                        <p>Convert to:</p>
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
                            // Also highlights the reader's own currency
                            // when it was picked from the list
                            selectedKey={
                                selectedChoice === "international"
                                    ? undefined
                                    : currencyKey(currency)
                            }
                            onSelect={setCurrency}
                        />
                    )}
                    <div className="income-distribution-unit-picker__divider" />
                    <div className="group-heading">Income per</div>
                    <Switcher
                        className="income-distribution-unit-picker__interval"
                        items={TIME_INTERVAL_ITEMS}
                        selectedKey={timeInterval}
                        onChange={setTimeInterval}
                        ariaLabel="Income per"
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
    return (
        <label
            className={cx(
                "income-distribution-unit-picker__choice",
                checked && "income-distribution-unit-picker__choice--checked"
            )}
        >
            <input
                type="radio"
                className="income-distribution-unit-picker__choice-input"
                name={name}
                checked={checked}
                onChange={onSelect}
            />
            <span>
                <span className="income-distribution-unit-picker__choice-label">
                    {label}
                </span>
                {detail && (
                    <span className="income-distribution-unit-picker__choice-detail">
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
}: {
    currencies: Currency[] | undefined
    selectedKey: string | undefined
    onSelect: (key: string) => void
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
            <div className="income-distribution-unit-picker__loading">
                Loading currencies…
            </div>
        )

    return (
        <div className="income-distribution-unit-picker__other">
            <Autocomplete filter={contains}>
                <SearchField
                    className="grapher-dropdown-search income-distribution-unit-picker__search"
                    aria-label="Search currencies"
                    autoFocus
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
                    className="grapher-dropdown-listbox income-distribution-unit-picker__listbox"
                    aria-label="Currencies"
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={selectedKeys}
                    onSelectionChange={handleSelectionChange}
                    renderEmptyState={() => (
                        <div className="income-distribution-unit-picker__empty">
                            No currencies found
                        </div>
                    )}
                >
                    {options.map((option) => (
                        <ListBoxItem
                            key={option.key}
                            id={option.key}
                            textValue={option.label}
                            className="income-distribution-unit-picker__option"
                        >
                            {option.label}
                        </ListBoxItem>
                    ))}
                </ListBox>
            </Autocomplete>
        </div>
    )
}
