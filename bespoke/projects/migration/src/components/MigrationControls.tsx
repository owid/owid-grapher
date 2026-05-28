import { useMemo } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowRight,
    faArrowRightArrowLeft,
} from "@fortawesome/free-solid-svg-icons"

import { BasicDropdownOption } from "@ourworldindata/grapher"
import { Tippy } from "@ourworldindata/utils"

import { groupByUserLocation } from "../../../../components/EntityDropdown/EntityDropdown.js"
import {
    type DropdownCollection,
    InlineLabeledDropdown,
} from "../../../../components/InlineLabeledDropdown/InlineLabeledDropdown.js"
import {
    Switcher,
    SwitcherItem,
} from "../../../../components/Switcher/Switcher.js"
import { TimeSlider } from "../../../../components/TimeSlider/TimeSlider.js"
import { useTippyContainer } from "../../../../hooks/useTippyContainer.js"
import { useUserCountryInformation } from "../../../../hooks/useUserCountryInformation.js"

import { GenderId, MigrationMetadata, MigrationView } from "../types.js"

const VIEW_ITEMS: SwitcherItem<MigrationView>[] = [
    {
        key: "immigrants",
        element: (
            <>
                <FontAwesomeIcon icon={faArrowRight} size="sm" aria-hidden />
                Immigrants
            </>
        ),
    },
    {
        key: "emigrants",
        element: (
            <>
                Emigrants
                <FontAwesomeIcon icon={faArrowRight} size="sm" aria-hidden />
            </>
        ),
    },
    {
        key: "both",
        element: (
            <>
                <FontAwesomeIcon
                    icon={faArrowRightArrowLeft}
                    size="sm"
                    aria-hidden
                />
                Both
            </>
        ),
    },
]

export function MigrationControls({
    metadata,
    country,
    genderId,
    year,
    view,
    viewDisabledReason,
    hideFlowSwitcher,
    setCountry,
    setGenderId,
    setYear,
    setView,
}: {
    metadata: MigrationMetadata
    country: string
    genderId: GenderId
    year: number
    view: MigrationView
    /** Reason text for the disabled-switcher tooltip. Undefined when the
     *  switcher is enabled (both halves have data). */
    viewDisabledReason?: string
    hideFlowSwitcher?: boolean
    setCountry: (name: string) => void
    setGenderId: (id: GenderId) => void
    setYear: (year: number) => void
    setView: (view: MigrationView) => void
}): React.ReactElement {
    return (
        <div className="migration-controls">
            <h3 className="migration-controls__title">Configure the data</h3>
            <div className="migration-controls__content">
                <div className="migration-controls__row">
                    <CountryDropdown
                        metadata={metadata}
                        country={country}
                        setCountry={setCountry}
                    />
                    <GenderDropdown
                        metadata={metadata}
                        genderId={genderId}
                        setGenderId={setGenderId}
                    />
                    {!hideFlowSwitcher && (
                        <ViewSwitcher
                            view={view}
                            disabledReason={viewDisabledReason}
                            setView={setView}
                        />
                    )}
                </div>
                <TimeSlider
                    times={metadata.times}
                    selectedTime={year}
                    onChange={setYear}
                />
            </div>
        </div>
    )
}

function CountryDropdown({
    metadata,
    country,
    setCountry,
}: {
    metadata: MigrationMetadata
    country: string
    setCountry: (name: string) => void
}) {
    // Country options are keyed by name so groupByUserLocation can match
    // the user's home country (also keyed by name in the geo lookup) and
    // surface it at the top.
    const { data: userCountryInfo } = useUserCountryInformation()
    const options = useMemo<DropdownCollection>(() => {
        const flat: BasicDropdownOption[] = metadata.entities
            .map((e) => ({ value: e.name, label: e.name }))
            .sort((a, b) => a.label.localeCompare(b.label))
        return groupByUserLocation(flat, userCountryInfo)
    }, [metadata.entities, userCountryInfo])

    return (
        <InlineLabeledDropdown
            label="Country"
            options={options}
            selectedValue={country}
            onChange={setCountry}
            placeholder="Select a country…"
            aria-label="Select a country"
            isSearchable
        />
    )
}

function GenderDropdown({
    metadata,
    genderId,
    setGenderId,
}: {
    metadata: MigrationMetadata
    genderId: GenderId
    setGenderId: (id: GenderId) => void
}) {
    const options = useMemo<BasicDropdownOption[]>(
        () =>
            metadata.genders.map((g) => ({
                value: String(g.id),
                label: g.name,
            })),
        [metadata.genders]
    )

    return (
        <InlineLabeledDropdown
            label="Gender"
            options={options}
            selectedValue={String(genderId)}
            onChange={(v) => setGenderId(Number(v) as GenderId)}
            placeholder="Select gender…"
            aria-label="Select gender"
        />
    )
}

function ViewSwitcher({
    view,
    disabledReason,
    setView,
}: {
    view: MigrationView
    disabledReason?: string
    setView: (view: MigrationView) => void
}) {
    const { ref: switcherWrapperRef, getTippyContainer } =
        useTippyContainer<HTMLDivElement>()

    const isDisabled = !!disabledReason

    return (
        <Tippy
            content={disabledReason ?? ""}
            disabled={!isDisabled}
            appendTo={getTippyContainer}
            maxWidth={270}
        >
            <div
                ref={switcherWrapperRef}
                className="migration-controls__switcher-wrapper"
            >
                <Switcher
                    items={VIEW_ITEMS}
                    selectedKey={view}
                    onChange={setView}
                    isDisabled={isDisabled}
                    aria-label="Migration flow"
                />
            </div>
        </Tippy>
    )
}
