import * as React from "react"
import "site/client/owid.scss"
import "charts/client/chart.scss"
import { SwitcherDataExplorer } from "dataExplorer/client/SwitcherDataExplorer"
import { SwitcherOptions } from "dataExplorer/client/SwitcherOptions"

const defaultConfig = `chartId	Gas	Accounting	Fuel	Count	Relative to world total
488	CO2	Production-based	Total	Per country	FALSE
3219	CO2	Production-based	Total	Per country	Share of global emissions
486	CO2	Production-based	Total	Per capita	
485	CO2	Production-based	Total	Cumulative	FALSE
3218	CO2	Production-based	Total	Cumulative	Share of global emissions
4267	CO2	Production-based	Total	Per unit of energy	
530	CO2	Production-based	Total	Per unit of GDP ($)	
3621	CO2	Consumption-based		Per country	
3488	CO2	Consumption-based		Per capita	
4331	CO2	Consumption-based		Per unit of GDP ($)	
696	CO2	Consumption-based		Share of emissions embedded in trade	
4250	CO2	Production-based	Coal	Per country	
4251	CO2	Production-based	Oil	Per country	
4253	CO2	Production-based	Gas	Per country	
4255	CO2	Production-based	Cement	Per country	
4332	CO2	Production-based	Flaring	Per country	
4249	CO2	Production-based	Coal	Per capita	
4252	CO2	Production-based	Oil	Per capita	
4254	CO2	Production-based	Gas	Per capita	
4256	CO2	Production-based	Cement	Per capita	
4333	CO2	Production-based	Flaring	Per capita	
4147	Total GHGs			Per country	
4239	Total GHGs			Per capita	
4222	Methane			Per country	
4243	Methane			Per capita	
4224	Nitrous oxide			Per country	
4244	Nitrous oxide			Per capita	`

export default {
    title: "SwitcherDataExplorer"
}

export const SwitcherTest = () => {
    const configs = new Map()
    const switcher = new SwitcherOptions(defaultConfig, "")
    return (
        <SwitcherDataExplorer
            queryString=""
            bindToWindow={false}
            chartConfigs={configs}
            explorerNamespace="co"
            explorerTitle="Test Explorer Switching"
            switcher={switcher}
        />
    )
}
