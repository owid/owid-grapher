import * as React from "react"
import "site/client/owid.scss"
import "charts/client/chart.scss"
import { CustomDataExplorer } from "charts/CustomDataExplorer"
import { co2ChartConfigs } from "./co2Explorer.test"

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
    title: "CustomDataExplorer"
}

export const Default = () => {
    // ;`http://localhost:3030/admin/api/charts/${chartId}.config.json`

    // http://localhost:3030/admin/api/charts/explorer-charts.config.json?chartIds=488~3219~486~485~3218~4267~530~3621~3488~4331~696~4250~4251~4253~4255~4332~4249~4252~4254~4256~4333~4147~4239~4222~4243~4224~4244

    // const chartIds = defaultConfig
    //     .split("\n")
    //     .slice(1)
    //     .map(line => line.split("\t")[0])
    // console.log(chartIds.join("~"))

    const configs = new Map()
    co2ChartConfigs.forEach(config => configs.set(config.id, config))
    return (
        <CustomDataExplorer
            chartConfigs={configs}
            explorerName="co2explorer"
            explorerConfig={defaultConfig}
        />
    )
}
