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

import { MigrationMetadata, MigrationView, Sex } from "../types.js"
import { sexFromName, OTHERS_ENTITY_NAME } from "../helpers.js"

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
    sex,
    year,
    view,
    viewDisabledReason,
    hideFlowSwitcher,
    setCountry,
    setSex,
    setYear,
    setView,
}: {
    metadata: MigrationMetadata
    country: string
    sex: Sex
    year: number
    view: MigrationView
    viewDisabledReason?: string
    hideFlowSwitcher?: boolean
    setCountry: (name: string) => void
    setSex: (sex: Sex) => void
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
                    <SexDropdown
                        metadata={metadata}
                        sex={sex}
                        setSex={setSex}
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
    const { data: userCountryInfo } = useUserCountryInformation()
    const options = useMemo<DropdownCollection>(() => {
        const flat: BasicDropdownOption[] = metadata.entities
            .filter((e) => e.name !== OTHERS_ENTITY_NAME)
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

function SexDropdown({
    metadata,
    sex,
    setSex,
}: {
    metadata: MigrationMetadata
    sex: Sex
    setSex: (sex: Sex) => void
}) {
    const options = useMemo<BasicDropdownOption[]>(
        () =>
            metadata.genders.map((g) => {
                const sex = sexFromName(g.name)
                return {
                    value: sex,
                    label: sex === "both" ? "Both sexes" : g.name,
                }
            }),
        [metadata.genders]
    )

    return (
        <InlineLabeledDropdown
            label="Sex"
            options={options}
            selectedValue={sex}
            onChange={(v) => setSex(v as Sex)}
            placeholder="Select sex…"
            aria-label="Select sex"
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
                    ariaLabel="Migration flow"
                />
            </div>
        </Tippy>
    )
}
