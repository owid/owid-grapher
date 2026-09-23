import { useMemo } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons"

import { BasicDropdownOption } from "@ourworldindata/grapher"
import { Tippy } from "@ourworldindata/utils"

import { orderOptionsByRelevance } from "../../../../components/EntityDropdown/EntityDropdown.js"
import {
    Controls,
    ControlsRow,
    LabeledControl,
} from "../../../../components/Controls/Controls.js"
import {
    type DropdownCollection,
    LabeledDropdown,
} from "../../../../components/LabeledDropdown/LabeledDropdown.js"
import {
    Switcher,
    SwitcherItem,
} from "../../../../components/Switcher/Switcher.js"
import { TimeSlider } from "../../../../components/TimeSlider/TimeSlider.js"
import { useTippyContainer } from "../../../../hooks/useTippyContainer.js"
import { useUserCountryInformation } from "../../../../hooks/useUserCountryInformation.js"

import {
    DeforestationMetadata,
    Period,
    View,
    YearRange,
} from "../core/types.js"

// Production reads left to right (the country → where its output went),
// consumption right to left (where its intake came from → the country)
const VIEW_ITEMS: SwitcherItem<View>[] = [
    {
        key: "production",
        element: (
            <>
                Production
                <FontAwesomeIcon icon={faArrowRight} size="sm" aria-hidden />
            </>
        ),
    },
    {
        key: "consumption",
        element: (
            <>
                <FontAwesomeIcon icon={faArrowRight} size="sm" aria-hidden />
                Consumption
            </>
        ),
    },
]

const PERIOD_ITEMS: SwitcherItem<Period>[] = [
    { key: "single-year", element: "Single year" },
    { key: "last-5-years", element: "Last 5 years" },
    { key: "last-10-years", element: "Last 10 years" },
]

export function DeforestationControls({
    metadata,
    country,
    yearRange,
    period,
    view,
    viewDisabledReason,
    hideFlowSwitcher,
    setCountry,
    setYear,
    setPeriod,
    setView,
}: {
    metadata: DeforestationMetadata
    country: string
    /** The years on screen: the slider's year, or a preset's span */
    yearRange: YearRange
    period: Period
    view: View
    viewDisabledReason?: string
    hideFlowSwitcher?: boolean
    setCountry: (name: string) => void
    setYear: (year: number) => void
    setPeriod: (period: Period) => void
    setView: (view: View) => void
}): React.ReactElement {
    return (
        <Controls className="deforestation-controls">
            <ControlsRow>
                {!hideFlowSwitcher && (
                    <ViewSwitcher
                        view={view}
                        disabledReason={viewDisabledReason}
                        setView={setView}
                    />
                )}
                <CountryDropdown
                    metadata={metadata}
                    country={country}
                    view={view}
                    setCountry={setCountry}
                />
            </ControlsRow>
            <TimePeriodControl
                metadata={metadata}
                yearRange={yearRange}
                period={period}
                setYear={setYear}
                setPeriod={setPeriod}
            />
        </Controls>
    )
}

function CountryDropdown({
    metadata,
    country,
    view,
    setCountry,
}: {
    metadata: DeforestationMetadata
    country: string
    view: View
    setCountry: (name: string) => void
}) {
    const { data: userCountryInfo } = useUserCountryInformation()
    const options = useMemo<DropdownCollection>(() => {
        const flat: BasicDropdownOption[] = metadata.entities.map((e) => ({
            value: e.name,
            label: e.name,
        }))
        return orderOptionsByRelevance(flat, {
            userCountryInfo,
            selectedValue: country,
        })
    }, [metadata.entities, userCountryInfo, country])

    return (
        <LabeledDropdown
            label={
                view === "production"
                    ? "Producing country"
                    : "Consuming country"
            }
            options={options}
            selectedValue={country}
            onChange={setCountry}
            placeholder="Select a country…"
            aria-label="Select a country"
            isSearchable
        />
    )
}

function ViewSwitcher({
    view,
    disabledReason,
    setView,
}: {
    view: View
    disabledReason?: string
    setView: (view: View) => void
}) {
    const { ref: switcherWrapperRef, getTippyContainer } =
        useTippyContainer<HTMLDivElement>()

    const isDisabled = !!disabledReason

    return (
        <LabeledControl label="What to show">
            <Tippy
                content={disabledReason ?? ""}
                disabled={!isDisabled}
                appendTo={getTippyContainer}
                maxWidth={270}
            >
                <div
                    ref={switcherWrapperRef}
                    className="deforestation-controls__switcher-wrapper"
                >
                    <Switcher
                        items={VIEW_ITEMS}
                        selectedKey={view}
                        onChange={setView}
                        isDisabled={isDisabled}
                        ariaLabel="Show production or consumption"
                    />
                </div>
            </Tippy>
        </LabeledControl>
    )
}

/**
 * The period switcher with the year slider under it, as one labelled
 * control. A preset period is pinned to the data's last years, so the slider
 * then only marks the span it covers and can't be moved — and the controls
 * keep their height when the reader switches.
 */
function TimePeriodControl({
    metadata,
    yearRange,
    period,
    setYear,
    setPeriod,
}: {
    metadata: DeforestationMetadata
    yearRange: YearRange
    period: Period
    setYear: (year: number) => void
    setPeriod: (period: Period) => void
}) {
    const isSingleYear = period === "single-year"
    return (
        <LabeledControl
            label="Time period"
            className="deforestation-controls__time"
        >
            <div className="deforestation-controls__time-controls">
                {/* Wrapped like the view switcher, so the two match */}
                <div className="deforestation-controls__switcher-wrapper deforestation-controls__period-switcher">
                    <Switcher
                        items={PERIOD_ITEMS}
                        selectedKey={period}
                        onChange={setPeriod}
                        ariaLabel="Show a single year or the sum of the last years"
                    />
                </div>
                {/* A preset period always ends in the latest year, so there
                    is nothing to pick on the timeline */}
                {isSingleYear && (
                    <TimeSlider
                        className="deforestation-controls__time-slider"
                        times={metadata.years}
                        selectedTime={yearRange.end}
                        onChange={setYear}
                    />
                )}
            </div>
        </LabeledControl>
    )
}
