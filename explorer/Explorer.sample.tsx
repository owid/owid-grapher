import React from "react"
import { DimensionProperty } from "@ourworldindata/utils"
import { GrapherProgrammaticInterface } from "../grapher/core/Grapher.js"
import { GrapherTabOption } from "../grapher/core/GrapherConstants.js"
import { Explorer, ExplorerProps } from "./Explorer.js"

const SampleExplorerOfGraphersProgram = `explorerTitle	CO₂ Data Explorer
isPublished	false
explorerSubtitle	Download the complete <i>Our World in Data</i> <a href="https://github.com/owid/co2-data">CO₂ and GHG Emissions Dataset</a>.
subNavId	co2
time	earliest..latest
selection	China	United States	India	United Kingdom	World
Gas Radio	CO₂
Accounting Radio	Production-based
subNavCurrentId	co2-data-explorer
graphers
	grapherId	Gas Radio	Accounting Radio	Fuel Dropdown	Count Dropdown	Relative to world total Checkbox	hasMapTab
	488	CO₂	Production-based	Total	Per country	false	true
	3219	CO₂	Production-based	Total	Per country	Share of global emissions	false
	486	CO₂	Production-based	Total	Per capita	false
	485	CO₂	Production-based	Total	Cumulative	false	false
	3218	CO₂	Production-based	Total	Cumulative	Share of global emissions	false
	4267	CO₂	Production-based	Total	Per MWh of energy	false
	530	CO₂	Production-based	Total	Per $ of GDP	false
	3621	CO₂	Consumption-based		Per country	false
	3488	CO₂	Consumption-based		Per capita	false
	4331	CO₂	Consumption-based		Per $ of GDP	false
	696	CO₂	Consumption-based		Share of emissions embedded in trade	false
	4250	CO₂	Production-based	Coal	Per country	false
	4251	CO₂	Production-based	Oil	Per country	false
	4253	CO₂	Production-based	Gas	Per country	false
	4255	CO₂	Production-based	Cement	Per country	false
	4332	CO₂	Production-based	Flaring	Per country	false
	4249	CO₂	Production-based	Coal	Per capita	false
	4252	CO₂	Production-based	Oil	Per capita	false
	4254	CO₂	Production-based	Gas	Per capita	false
	4256	CO₂	Production-based	Cement	Per capita	false
	4333	CO₂	Production-based	Flaring	Per capita	false
	4147	All GHGs (CO₂eq)	Production-based		Per country	false
	4239	All GHGs (CO₂eq)	Production-based		Per capita	false
	4222	Methane	Production-based		Per country	false
	4243	Methane	Production-based		Per capita	false
	4224	Nitrous oxide	Production-based		Per country	false
	4244	Nitrous oxide	Production-based		Per capita	false`

export const SampleExplorerOfGraphers = (props?: Partial<ExplorerProps>) => {
    const title = "AlphaBeta"
    const first: GrapherProgrammaticInterface = {
        id: 488,
        title,
        dimensions: [
            {
                variableId: 142609,
                property: DimensionProperty.y,
            },
        ],
        tab: GrapherTabOption.chart,
        owidDataset: new Map([
            [
                142609,
                {
                    data: {
                        years: [-1, 0, 1, 2],
                        entities: [1, 2, 1, 2],
                        values: [51, 52, 53, 54],
                    },
                    metadata: {
                        id: 142609,
                        display: { zeroDay: "2020-01-21", yearIsDay: true },
                        dimensions: {
                            entities: {
                                values: [
                                    {
                                        name: "United Kingdom",
                                        code: "GBR",
                                        id: 1,
                                    },
                                    { name: "Ireland", code: "IRL", id: 2 },
                                ],
                            },
                            years: {
                                values: [
                                    {
                                        id: -1,
                                    },
                                    {
                                        id: 0,
                                    },
                                    {
                                        id: 1,
                                    },
                                    {
                                        id: 2,
                                    },
                                ],
                            },
                        },
                    },
                },
            ],
        ]),
    }
    const grapherConfigs: GrapherProgrammaticInterface[] = [
        first,
        {
            ...first,
            id: 4147,
            title: "Switched to Something Else",
        },
    ]
    return (
        <Explorer
            slug="test-slug"
            program={SampleExplorerOfGraphersProgram}
            grapherConfigs={grapherConfigs}
            {...props}
        />
    )
}

const SampleInlineDataExplorerProgram = `explorerTitle	Sample Explorer
selection	Argentina
graphers
	Test Radio	xSlug	ySlugs	colorSlug	sizeSlug	type
	Scatter	x	y	color	size	ScatterPlot
	Line		y			LineChart

columns
	slug	type	name
	Country	EntityName	Country
	Quarter	Quarter	Quarter
	x	Numeric	x
	y	Numeric	y
	color	Numeric	color
	size	Numeric	size

table
	Country	Year	x	y	color	size
	Argentina	2020	1	1	1	1
	Argentina	2021	1	1	1	1`

export const SampleInlineDataExplorer = (props?: Partial<ExplorerProps>) => {
    return (
        <Explorer
            slug="test-slug-inline-data"
            program={SampleInlineDataExplorerProgram}
            {...props}
        />
    )
}
