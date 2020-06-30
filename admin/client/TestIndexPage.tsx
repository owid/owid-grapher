import * as React from "react"
import { observer } from "mobx-react"

import { AdminLayout } from "./AdminLayout"
import { Link } from "./Link"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext"

@observer
export class TestIndexPage extends React.Component {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    render() {
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
                                to="/test/embeds?type=ChoroplethMap"
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
                                to="/test/embeds?logLinear=true"
                            >
                                All charts with log scale switches
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
                            <Link native to="/test/compareSvgs">
                                View changed SVGs
                            </Link>
                        </li>
                    </ul>
                </main>
            </AdminLayout>
        )
    }
}
