import { useMemo } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faFlag, faGlobe } from "@fortawesome/free-solid-svg-icons"

import {
    Controls,
    ControlsRow,
    LabeledControl,
} from "../../../../components/Controls/Controls.js"
import {
    type BasicDropdownOption,
    type DropdownCollection,
    LabeledDropdown,
} from "../../../../components/LabeledDropdown/LabeledDropdown.js"
import {
    Switcher,
    SwitcherItem,
} from "../../../../components/Switcher/Switcher.js"

import {
    INTERNATIONAL_DOLLAR,
    TIME_INTERVAL_LABELS,
} from "../core/constants.js"
import { currencyKey, formatCurrencyLabel } from "../core/currency.js"
import {
    Breakdown,
    Currency,
    TIME_INTERVALS,
    TimeInterval,
    View,
} from "../core/types.js"
import { CountryMultiSelect } from "./CountryMultiSelect.js"

export interface IncomeDistributionControlsProps {
    view: View
    setView: (v: View) => void
    breakdown: Breakdown
    setBreakdown: (b: Breakdown) => void
    selectedCountries: string[]
    setSelectedCountries: (names: string[]) => void
    /** Sorted names from the year's data */
    availableCountries: string[]
    timeInterval: TimeInterval
    setTimeInterval: (t: TimeInterval) => void
    currency: Currency
    /** Takes a country code (see `currencyKey` in core/currency.ts) or INTERNATIONAL_DOLLAR.code */
    setCurrency: (key: string) => void
    /** Undefined while loading or when the conversions failed to load */
    currencies: Currency[] | undefined
    /** The reader's local currency, if known */
    suggestedCurrency?: Currency
    isNarrow: boolean
}

const VIEW_ITEMS: SwitcherItem<View>[] = [
    {
        key: "global",
        element: (
            <>
                <FontAwesomeIcon icon={faGlobe} size="sm" aria-hidden />
                Global
            </>
        ),
    },
    {
        key: "countries",
        element: (
            <>
                <FontAwesomeIcon icon={faFlag} size="sm" aria-hidden />
                Selected countries
            </>
        ),
    },
]

const BREAKDOWN_ITEMS: SwitcherItem<Breakdown>[] = [
    { key: "regions", element: "Regions" },
    { key: "countries", element: "Countries" },
]

const TIME_INTERVAL_OPTIONS: BasicDropdownOption[] = TIME_INTERVALS.map(
    (interval) => ({ value: interval, label: TIME_INTERVAL_LABELS[interval] })
)

export function IncomeDistributionControls({
    view,
    setView,
    breakdown,
    setBreakdown,
    selectedCountries,
    setSelectedCountries,
    availableCountries,
    timeInterval,
    setTimeInterval,
    currency,
    setCurrency,
    currencies,
    suggestedCurrency,
    isNarrow,
}: IncomeDistributionControlsProps): React.ReactElement {
    return (
        <Controls className="income-distribution-controls">
            <ControlsRow>
                <LabeledControl
                    label="View"
                    className="income-distribution-controls__switcher"
                >
                    <Switcher
                        items={VIEW_ITEMS}
                        selectedKey={view}
                        onChange={setView}
                        ariaLabel="View"
                    />
                </LabeledControl>
                {view === "global" ? (
                    <LabeledControl
                        label="Show"
                        className="income-distribution-controls__switcher"
                    >
                        <Switcher
                            items={BREAKDOWN_ITEMS}
                            selectedKey={breakdown}
                            onChange={setBreakdown}
                            ariaLabel="Show regions or countries"
                        />
                    </LabeledControl>
                ) : (
                    <LabeledControl
                        label="Countries"
                        className="income-distribution-controls__countries"
                    >
                        <CountryMultiSelect
                            availableCountries={availableCountries}
                            selectedCountries={selectedCountries}
                            onChange={setSelectedCountries}
                            isNarrow={isNarrow}
                        />
                    </LabeledControl>
                )}
            </ControlsRow>
            <ControlsRow>
                <LabeledDropdown
                    className="income-distribution-controls__time-interval"
                    label="Income per"
                    options={TIME_INTERVAL_OPTIONS}
                    selectedValue={timeInterval}
                    onChange={(value) => {
                        const interval = TIME_INTERVALS.find((t) => t === value)
                        if (interval) setTimeInterval(interval)
                    }}
                    aria-label="Income per"
                />
                <CurrencyDropdown
                    currency={currency}
                    setCurrency={setCurrency}
                    currencies={currencies}
                    suggestedCurrency={suggestedCurrency}
                />
            </ControlsRow>
        </Controls>
    )
}

function CurrencyDropdown({
    currency,
    setCurrency,
    currencies,
    suggestedCurrency,
}: {
    currency: Currency
    setCurrency: (key: string) => void
    currencies: Currency[] | undefined
    suggestedCurrency?: Currency
}): React.ReactElement {
    const options = useMemo<DropdownCollection>(() => {
        const intDollar: BasicDropdownOption = {
            value: INTERNATIONAL_DOLLAR.code,
            label: formatCurrencyLabel(INTERNATIONAL_DOLLAR),
        }
        if (!currencies?.length) return [intDollar]

        const suggestedKey = suggestedCurrency?.countryCode
        const toOption = (c: Currency): BasicDropdownOption => ({
            value: currencyKey(c),
            label: formatCurrencyLabel(c),
        })
        // Listbox ids must be unique, so the suggested row isn't repeated in
        // the full list
        const all = currencies
            .filter((c) => c.countryCode !== suggestedKey)
            .map(toOption)

        return [
            intDollar,
            ...(suggestedCurrency && suggestedKey
                ? [
                      {
                          label: "Suggested",
                          options: [toOption(suggestedCurrency)],
                      },
                  ]
                : []),
            { label: "All countries", options: all },
        ]
    }, [currencies, suggestedCurrency])

    return (
        <LabeledDropdown
            className="income-distribution-controls__currency"
            label="Currency"
            options={options}
            selectedValue={currencyKey(currency)}
            onChange={setCurrency}
            placeholder="Select a currency…"
            aria-label="Currency"
            isSearchable
            isLoading={currencies === undefined}
        />
    )
}
