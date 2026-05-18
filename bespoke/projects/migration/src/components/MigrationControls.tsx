import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowRight,
    faArrowRightArrowLeft,
} from "@fortawesome/free-solid-svg-icons"

import { BasicDropdownOption } from "@ourworldindata/grapher"
import { Time } from "@ourworldindata/types"

import { Frame } from "../../../../components/Frame/Frame.js"
import { TimeSlider } from "../../../../components/TimeSlider/TimeSlider.js"
import {
    type DropdownCollection,
    InlineLabeledDropdown,
} from "../../../../components/InlineLabeledDropdown/InlineLabeledDropdown.js"
import {
    Switcher,
    SwitcherItem,
} from "../../../../components/Switcher/Switcher.js"

import { GenderId } from "../data.js"
import { MigrationView } from "./MigrationSankey.js"

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
    countryOptions,
    genderOptions,
    times,
    country,
    genderId,
    year,
    view,
    viewDisabled,
    hideFlowSwitcher,
    setCountry,
    setGenderId,
    setYear,
    setView,
}: {
    countryOptions: DropdownCollection
    genderOptions: BasicDropdownOption[]
    times: Time[]
    country: string
    genderId: GenderId
    year: Time
    view: MigrationView
    /** Visually disables the migration-flow radios. Set when the current
     * country has data in only one direction, so the radios reflect
     * "doesn't apply here" rather than letting the user pick a half with
     * no data. */
    viewDisabled?: boolean
    hideFlowSwitcher?: boolean
    setCountry: (name: string) => void
    setGenderId: (id: GenderId) => void
    setYear: (year: Time) => void
    setView: (view: MigrationView) => void
}): React.ReactElement {
    return (
        <Frame className="migration-controls">
            <h3 className="migration-controls__title">Configure the data</h3>
            <div className="migration-controls__content">
                <div className="migration-controls__row">
                    <InlineLabeledDropdown
                        label="Country"
                        options={countryOptions}
                        selectedValue={country}
                        onChange={setCountry}
                        placeholder="Select a country…"
                        aria-label="Select a country"
                        isSearchable
                    />
                    <InlineLabeledDropdown
                        label="Gender"
                        options={genderOptions}
                        selectedValue={String(genderId)}
                        onChange={(v) => setGenderId(Number(v) as GenderId)}
                        placeholder="Select gender…"
                        aria-label="Select gender"
                    />
                    <Switcher
                        items={VIEW_ITEMS}
                        selectedKey={view}
                        onChange={setView}
                        isDisabled={viewDisabled}
                        aria-label="Migration flow"
                    />
                </div>
                <TimeSlider
                    times={times}
                    selectedTime={year}
                    onChange={setYear}
                />
            </div>
        </Frame>
    )
}
