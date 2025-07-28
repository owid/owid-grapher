import { Component } from "react"
import { observer } from "mobx-react"

import { AdminLayout } from "./AdminLayout.js"
import { Link } from "./Link.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"

@observer
export class TestIndexPage extends Component {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    override render() {
        return (
            <AdminLayout title="Test">
                <main className="TestIndexPage">
                    <h2>Test Embeds</h2>
                    <ul>
                        <li>
                            <Link native target="_blank" to="/test/embeds">
                                All Charts
                            </Link>
                        </li>
                        <li>
                            <Link
                                native
                                target="_blank"
                                to={`/test/embeds?random=true`}
                            >
                                Random Page of Charts
                            </Link>
                        </li>
                        <li>
                            <Link
                                native
                                target="_blank"
                                to="/test/embeds?type=WorldMap"
                            >
                                Choropleth Map
                            </Link>
                        </li>
                        <li>
                            <Link
                                native
                                target="_blank"
                                to="/test/embeds?type=LineChart"
                            >
                                Line Chart
                            </Link>
                        </li>
                        <li>
                            <Link
                                native
                                target="_blank"
                                to="/test/embeds?type=SlopeChart"
                            >
                                Slope Chart
                            </Link>
                        </li>
                        <li>
                            <Link
                                native
                                target="_blank"
                                to="/test/embeds?type=DiscreteBar"
                            >
                                Discrete Bar
                            </Link>
                        </li>
                        <li>
                            <Link
                                native
                                target="_blank"
                                to="/test/embeds?type=ScatterPlot"
                            >
                                Scatter Plot
                            </Link>
                        </li>
                        <li>
                            <Link
                                native
                                target="_blank"
                                to="/test/embeds?type=StackedArea"
                            >
                                Stacked Area
                            </Link>
                        </li>
                        <li>
                            <Link
                                native
                                target="_blank"
                                to="/test/embeds?type=StackedBar"
                            >
                                Stacked Bar
                            </Link>
                        </li>
                        <li>
                            <Link
                                native
                                target="_blank"
                                to="/test/embeds?type=Marimekko"
                            >
                                Marimekko
                            </Link>
                        </li>
                        <li>
                            <Link
                                native
                                target="_blank"
                                to="/test/embeds?type=StackedDiscreteBar"
                            >
                                Stacked Discrete Bar
                            </Link>
                        </li>

                        <li>
                            <Link
                                native
                                target="_blank"
                                to="/test/embeds?logLinear=true"
                            >
                                All charts with log scale switches
                            </Link>
                        </li>

                        <li>
                            <Link
                                native
                                target="_blank"
                                to="/test/embeds?comparisonLines=true"
                            >
                                All charts with comparison lines
                            </Link>
                        </li>

                        <li>
                            <Link
                                native
                                target="_blank"
                                to="/test/embeds?categoricalLegend=true"
                            >
                                All charts with categorical legends
                            </Link>
                        </li>

                        <li>
                            <Link
                                native
                                target="_blank"
                                to="/test/embeds?stackMode=true"
                            >
                                All charts with relative stack mode
                            </Link>
                        </li>

                        <li>
                            <Link
                                native
                                target="_blank"
                                to="/test/embeds?relativeToggle=true"
                            >
                                All charts with relative toggles
                            </Link>
                        </li>

                        <li>
                            <Link
                                native
                                target="_blank"
                                to="/test/embedVariants"
                            >
                                Embed Variants
                            </Link>
                        </li>

                        <li>
                            <Link
                                native
                                target="_blank"
                                to="/test/colorSchemes?slug=life-expectancy&tab=map"
                            >
                                Color Schemes
                            </Link>
                        </li>
                    </ul>

                    <h2>Test Explorer Embeds</h2>
                    <ul>
                        <li>
                            <Link native target="_blank" to="/test/explorers">
                                All explorers
                            </Link>
                        </li>
                        <li>
                            <Link
                                native
                                target="_blank"
                                to="/test/explorers?type=grapher-ids"
                            >
                                Grapher ID-based explorers
                            </Link>
                        </li>
                        <li>
                            <Link
                                native
                                target="_blank"
                                to="/test/explorers?type=csv-files"
                            >
                                CSV file-based explorers
                            </Link>
                        </li>
                        <li>
                            <Link
                                native
                                target="_blank"
                                to="/test/explorers?type=indicators"
                            >
                                Indicator-based explorers
                            </Link>
                        </li>
                    </ul>
                </main>
            </AdminLayout>
        )
    }
}
