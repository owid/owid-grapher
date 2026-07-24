import { useMemo } from "react"

import { Checkbox } from "@ourworldindata/components"
import { BasicDropdownOption } from "@ourworldindata/grapher"
import { Tippy } from "@ourworldindata/utils"

import { Frame } from "../../../../components/Frame/Frame.js"
import { orderOptionsByRelevance } from "../../../../components/EntityDropdown/EntityDropdown.js"
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

import { MigrantDemographics } from "../data.js"
import { ShowMode } from "../types.js"
import { WORLD_ENTITY_NAME } from "../constants.js"

const SHOW_MODE_ITEMS: SwitcherItem<ShowMode>[] = [
    { key: "number", element: "Number of immigrants" },
    { key: "share", element: "Share of immigrants" },
]

const SHOW_MODE_DISABLED_REASON =
    "When comparing with native-born residents, values are always shown as a share of each population — there are far more native-born residents than immigrants."

export function PyramidControls({
    data,
    country,
    year,
    show,
    compare,
    setCountry,
    setYear,
    setShow,
    setCompare,
}: {
    data: MigrantDemographics
    country: string
    year: number
    show: ShowMode
    compare: boolean
    setCountry: (name: string) => void
    setYear: (year: number) => void
    setShow: (show: ShowMode) => void
    setCompare: (compare: boolean) => void
}): React.ReactElement {
    return (
        <Frame className="migrant-pyramid-controls">
            <h3 className="migrant-pyramid-controls__title">
                Configure the data
            </h3>
            <div className="migrant-pyramid-controls__content">
                <div className="migrant-pyramid-controls__row">
                    <CountryDropdown
                        data={data}
                        country={country}
                        setCountry={setCountry}
                    />
                    <ShowModeSwitcher
                        show={show}
                        compare={compare}
                        setShow={setShow}
                    />
                    <CompareCheckbox
                        compare={compare}
                        setCompare={setCompare}
                    />
                </div>
                <TimeSlider
                    times={data.years}
                    selectedTime={year}
                    onChange={setYear}
                />
            </div>
        </Frame>
    )
}

function CountryDropdown({
    data,
    country,
    setCountry,
}: {
    data: MigrantDemographics
    country: string
    setCountry: (name: string) => void
}): React.ReactElement {
    const { data: userCountryInfo } = useUserCountryInformation()
    const options = useMemo<DropdownCollection>(() => {
        const flat: BasicDropdownOption[] = data.entityNames
            .map((name) => ({ value: name, label: name }))
            .sort((a, b) => a.label.localeCompare(b.label))
        return orderOptionsByRelevance(flat, {
            userCountryInfo,
            pinnedToTop: [WORLD_ENTITY_NAME],
            selectedValue: country,
        })
    }, [data.entityNames, userCountryInfo, country])

    return (
        <InlineLabeledDropdown
            label="Country or region"
            options={options}
            selectedValue={country}
            onChange={setCountry}
            placeholder="Select a country or region…"
            aria-label="Select a country or region"
            isSearchable
        />
    )
}

function ShowModeSwitcher({
    show,
    compare,
    setShow,
}: {
    show: ShowMode
    compare: boolean
    setShow: (show: ShowMode) => void
}): React.ReactElement {
    const { ref: wrapperRef, getTippyContainer } =
        useTippyContainer<HTMLDivElement>()

    return (
        <Tippy
            content={SHOW_MODE_DISABLED_REASON}
            disabled={!compare}
            appendTo={getTippyContainer}
            maxWidth={270}
        >
            <div ref={wrapperRef} className="migrant-pyramid-controls__show">
                <Switcher
                    items={SHOW_MODE_ITEMS}
                    selectedKey={compare ? "share" : show}
                    onChange={setShow}
                    isDisabled={compare}
                    ariaLabel="Show numbers or shares"
                />
            </div>
        </Tippy>
    )
}

function CompareCheckbox({
    compare,
    setCompare,
}: {
    compare: boolean
    setCompare: (compare: boolean) => void
}): React.ReactElement {
    // Grapher's native-input checkbox — don't swap for react-aria, whose
    // press handling drops clicks without pointer events (light trackpad
    // taps)
    return (
        <Checkbox
            className="migrant-pyramid-controls__compare"
            checked={compare}
            onChange={(e) => setCompare(e.target.checked)}
            label="Compare with native-born"
        />
    )
}
