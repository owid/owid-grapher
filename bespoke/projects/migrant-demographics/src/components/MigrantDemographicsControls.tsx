import { useMemo } from "react"

import { faCheck } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Time } from "@ourworldindata/types"

import { Frame } from "../../../../components/Frame/Frame.js"
import { EntityDropdown } from "../../../../components/EntityDropdown/EntityDropdown.js"
import { TimeSlider } from "../../../../components/TimeSlider/TimeSlider.js"
import { Switcher } from "../../../../components/Switcher/Switcher.js"

import { MetricMode } from "../helpers/constants.js"

export function MigrantDemographicsControls({
    entityNames,
    entityName,
    years,
    year,
    metric,
    compare,
    setEntityName,
    setYear,
    setMetric,
    setCompare,
}: {
    entityNames: string[]
    entityName: string
    years: Time[]
    year: Time
    metric: MetricMode
    compare: boolean
    setEntityName: (entityName: string) => void
    setYear: (year: Time) => void
    setMetric: (metric: MetricMode) => void
    setCompare: (compare: boolean) => void
}): React.ReactElement {
    const entityOptions = useMemo(
        () =>
            entityNames.map((name) => ({
                value: name,
                label: name,
            })),
        [entityNames]
    )

    return (
        <Frame className="migrant-demographics-controls">
            <div className="migrant-demographics-controls__row">
                <div className="migrant-demographics-controls__field">
                    <label className="migrant-demographics-controls__label">
                        Country or region
                    </label>
                    <EntityDropdown
                        label="Country or region"
                        availableEntities={entityOptions}
                        selectedEntityName={entityName}
                        onChange={setEntityName}
                        placeholder="Select a country or region..."
                        aria-label="Select a country or region"
                    />
                </div>
                <div className="migrant-demographics-controls__field migrant-demographics-controls__field--year">
                    <label className="migrant-demographics-controls__label">
                        Year: <strong>{year}</strong>
                    </label>
                    <TimeSlider
                        className="migrant-demographics-time-slider"
                        times={years}
                        selectedTime={year}
                        onChange={setYear}
                    />
                </div>
            </div>

            <div className="migrant-demographics-controls__row migrant-demographics-controls__row--toggles">
                {!compare && (
                    <div className="migrant-demographics-controls__field migrant-demographics-controls__field--metric">
                        <label className="migrant-demographics-controls__label">
                            Show
                        </label>
                        <Switcher<MetricMode>
                            className="migrant-demographics-metric-switcher"
                            ariaLabel="Show absolute numbers or shares"
                            selectedKey={metric}
                            onChange={setMetric}
                            items={[
                                { key: "number", element: "Number" },
                                { key: "share", element: "Share" },
                            ]}
                        />
                    </div>
                )}
                <label className="migrant-demographics-checkbox">
                    <input
                        type="checkbox"
                        className="migrant-demographics-checkbox__input"
                        checked={compare}
                        onChange={(event) => setCompare(event.target.checked)}
                    />
                    <span
                        className="migrant-demographics-checkbox__box"
                        aria-hidden
                    >
                        <FontAwesomeIcon icon={faCheck} />
                    </span>
                    <span className="migrant-demographics-checkbox__label">
                        Compare with native-born
                    </span>
                </label>
            </div>
        </Frame>
    )
}
