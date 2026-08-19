import { useMemo } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowRight,
    faArrowRightArrowLeft,
} from "@fortawesome/free-solid-svg-icons"

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

import { MigrationMetadata, MigrationView, Sex } from "../core/types.js"
import { sexFromName, OTHERS_ENTITY_NAME } from "../core/helpers.js"

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
        <Controls className="migration-controls">
            <ControlsRow>
                <CountryDropdown
                    metadata={metadata}
                    country={country}
                    setCountry={setCountry}
                />
                <SexSwitcher metadata={metadata} sex={sex} setSex={setSex} />
                {!hideFlowSwitcher && (
                    <ViewSwitcher
                        view={view}
                        disabledReason={viewDisabledReason}
                        setView={setView}
                    />
                )}
            </ControlsRow>
            <TimeSlider
                times={metadata.times}
                selectedTime={year}
                onChange={setYear}
            />
        </Controls>
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
        return orderOptionsByRelevance(flat, {
            userCountryInfo,
            selectedValue: country,
        })
    }, [metadata.entities, userCountryInfo, country])

    return (
        <LabeledDropdown
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

function SexSwitcher({
    metadata,
    sex,
    setSex,
}: {
    metadata: MigrationMetadata
    sex: Sex
    setSex: (sex: Sex) => void
}) {
    const items = useMemo<SwitcherItem<Sex>[]>(
        () =>
            metadata.genders.map((g) => {
                const key = sexFromName(g.name)
                return { key, element: key === "both" ? "Both" : g.name }
            }),
        [metadata.genders]
    )

    return (
        <LabeledControl label="Sex">
            <Switcher
                items={items}
                selectedKey={sex}
                onChange={setSex}
                ariaLabel="Select sex"
            />
        </LabeledControl>
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
        <LabeledControl label="Migration flow">
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
        </LabeledControl>
    )
}
