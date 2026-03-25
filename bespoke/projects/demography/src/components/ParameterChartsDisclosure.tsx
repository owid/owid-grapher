import {
    Disclosure,
    DisclosurePanel,
    Button,
} from "react-aria-components"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faAngleRight } from "@fortawesome/free-solid-svg-icons"
import { GRAY_60 } from "@ourworldindata/grapher/src/color/ColorConstants.js"
import { BENCHMARK_LINE_COLOR } from "../helpers/constants.js"
import type { Simulation } from "../helpers/useSimulation.js"
import { InputChartPanel } from "./SimulationContent.js"

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
                        variant="lifeExpectancy"
                        className="assumptions-panel chart-panel--muted"
                        interactive={false}
                        lineColor={BENCHMARK_LINE_COLOR}
                        labelColor={GRAY_60}
                        showProjectionLabel
                    />
                    <InputChartPanel
                        simulation={simulation}
                        variant="fertilityRate"
                        className="assumptions-panel chart-panel--muted"
                        interactive={false}
                        lineColor={BENCHMARK_LINE_COLOR}
                        labelColor={GRAY_60}
                    />
                    <InputChartPanel
                        simulation={simulation}
                        variant="netMigrationRate"
                        className="assumptions-panel chart-panel--muted"
                        interactive={false}
                        lineColor={BENCHMARK_LINE_COLOR}
                        labelColor={GRAY_60}
                        hideInfoIcon={isWorld}
                    />
                </div>
            </DisclosurePanel>
        </Disclosure>
    )
}
