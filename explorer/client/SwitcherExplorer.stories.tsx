import * as React from "react"
import "site/client/owid.scss"
import "charts/core/chart.scss"
import { SwitcherExplorer } from "explorer/client/SwitcherExplorer"
import { ExplorerProgram } from "explorer/client/ExplorerProgram"

export default {
    title: "SwitcherExplorer",
    component: SwitcherExplorer
}

export const SwitcherTest = () => {
    const code = `title	CO₂ Data Explorer
isPublished	false
subtitle	Download the complete <i>Our World in Data</i> <a href="https://github.com/owid/co2-data">CO₂ and GHG Emissions Dataset</a>.
defaultView	?tab=chart&time=earliest..latest&country=China~United%20States~India~United%20Kingdom~World&Gas%20=CO₂&Accounting%20=Production-based&Fuel%20=Total&Count%20=Per%20capita&Relative%20to%20world%20total%20=
subNavId	co2
subNavCurrentId	co2-data-explorer
switcher
	chartId	Gas Radio	Accounting Radio	Fuel Dropdown	Count Dropdown	Relative to world total Checkbox
	488	CO₂	Production-based	Total	Per country	FALSE
	3219	CO₂	Production-based	Total	Per country	Share of global emissions
	486	CO₂	Production-based	Total	Per capita
	485	CO₂	Production-based	Total	Cumulative	FALSE
	3218	CO₂	Production-based	Total	Cumulative	Share of global emissions
	4267	CO₂	Production-based	Total	Per MWh of energy
	530	CO₂	Production-based	Total	Per $ of GDP
	3621	CO₂	Consumption-based		Per country
	3488	CO₂	Consumption-based		Per capita
	4331	CO₂	Consumption-based		Per $ of GDP
	696	CO₂	Consumption-based		Share of emissions embedded in trade
	4250	CO₂	Production-based	Coal	Per country
	4251	CO₂	Production-based	Oil	Per country
	4253	CO₂	Production-based	Gas	Per country
	4255	CO₂	Production-based	Cement	Per country
	4332	CO₂	Production-based	Flaring	Per country
	4249	CO₂	Production-based	Coal	Per capita
	4252	CO₂	Production-based	Oil	Per capita
	4254	CO₂	Production-based	Gas	Per capita
	4256	CO₂	Production-based	Cement	Per capita
	4333	CO₂	Production-based	Flaring	Per capita
	4147	All GHGs (CO₂eq)	Production-based		Per country
	4239	All GHGs (CO₂eq)	Production-based		Per capita
	4222	Methane	Production-based		Per country
	4243	Methane	Production-based		Per capita
	4224	Nitrous oxide	Production-based		Per country
	4244	Nitrous oxide	Production-based		Per capita`
    const configs = new Map()
    const program = new ExplorerProgram("some-slug", code)
    return (
        <SwitcherExplorer
            bindToWindow={false}
            chartConfigs={configs}
            program={program}
        />
    )
}
