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

import { DeforestationMetadata, View } from "../core/types.js"

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

export function DeforestationControls({
    metadata,
    country,
    year,
    view,
    viewDisabledReason,
    hideFlowSwitcher,
    setCountry,
    setYear,
    setView,
}: {
    metadata: DeforestationMetadata
    country: string
    year: number
    view: View
    viewDisabledReason?: string
    hideFlowSwitcher?: boolean
    setCountry: (name: string) => void
    setYear: (year: number) => void
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
            <TimeSlider
                times={metadata.years}
                selectedTime={year}
                onChange={setYear}
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
