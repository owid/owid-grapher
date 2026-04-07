import { Disclosure, DisclosurePanel, Button } from "react-aria-components"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faAngleRight } from "@fortawesome/free-solid-svg-icons"
import {
    BENCHMARK_LINE_COLOR,
    START_YEAR,
    HISTORICAL_END_YEAR,
    END_YEAR,
} from "../helpers/constants.js"
import { GRAY_60 } from "@ourworldindata/grapher/src/color/ColorConstants.js"
import type { Simulation } from "../helpers/useSimulation.js"
import { InputChartPanel } from "./SimulationContent.js"

const YEAR_LABELS = [
    [START_YEAR, "start"],
    [HISTORICAL_END_YEAR, "middle"],
    [END_YEAR, "end"],
] as const

export function ParameterChartsDisclosure({
    simulation,
}: {
    simulation: Simulation
}) {
    const isWorld = simulation.data.country === "World"
    return (
        <Disclosure className="demography-assumptions-disclosure">
            <Button
                slot="trigger"
                className="demography-assumptions-disclosure__trigger"
            >
                <FontAwesomeIcon
                    icon={faAngleRight}
                    className="demography-assumptions-disclosure__arrow"
                    size="sm"
                />
                Show demographic assumptions
            </Button>
            <DisclosurePanel className="demography-assumptions-disclosure__panel">
                <div className="demography-assumptions-disclosure__charts">
                    <InputChartPanel
                        simulation={simulation}
                        variant="fertilityRate"
                        className="assumptions-panel"
                        interactive={false}
                        showProjectionLabel
                        yearLabels={YEAR_LABELS}
                        maxGridLines={0}
                        showEndpointLabels
                        yMin={0}
                    />
                    <InputChartPanel
                        simulation={simulation}
                        variant="lifeExpectancy"
                        className="assumptions-panel"
                        interactive={false}
                        yearLabels={YEAR_LABELS}
                        maxGridLines={0}
                        showEndpointLabels
                        yMin={0}
                    />
                    <InputChartPanel
                        simulation={simulation}
                        variant="netMigrationRate"
                        className="assumptions-panel"
                        interactive={false}
                        hideInfoIcon={isWorld}
                        lineColor={isWorld ? BENCHMARK_LINE_COLOR : undefined}
                        labelColor={isWorld ? GRAY_60 : undefined}
                        yearLabels={YEAR_LABELS}
                        maxGridLines={1}
                        showEndpointLabels
                    />
                </div>
            </DisclosurePanel>
        </Disclosure>
    )
}
