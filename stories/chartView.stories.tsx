import * as React from "react"
import { observable, action } from "mobx"
import { observer } from "mobx-react"

import { Bounds } from "charts/Bounds"
import { ChartView } from "charts/ChartView"
import { ChartConfig, ChartConfigProps } from "charts/ChartConfig"

const chartViewData = {
    variables: {
        "66287": {
            years: [1543, 1548],
            entities: [1, 1],
            values: [32, 33],
            id: 66287,
            name:
                "Life expectancy (Clio-Infra up to 1949; UN Population Division for 1950 to 2015)",
            unit: "",
            description:
                "Clio-Infra data measures life expectancy at birth for the total population per country and year. UN Population Division figures estimate life expectancy at birth for both sexes combined.",
            createdAt: "2018-01-04T15:25:44.000Z",
            updatedAt: "2018-02-28T08:59:09.000Z",
            code: null,
            coverage: "",
            timespan: "",
            datasetId: 1892,
            sourceId: 13901,
            shortUnit: null,
            display: {},
            columnOrder: 0,
            originalMetadata: null,
            datasetName:
                "Total Life Expectancy - Clio-Infra up to 1949 and UN figures from 1950 onwards (2015)",
            s_id: 13901,
            s_name:
                "Clio-Infra estimates until 1949; UN Population Division from 1950 to 2015",
            source: {
                id: 13901,
                name:
                    "Clio-Infra estimates until 1949; UN Population Division from 1950 to 2015",
                dataPublishedBy:
                    "OWID has combined two data sources: Clio-Infra's dataset for life expectancy up until 1949; and the UN Population Division for data from 1950 to 2015.",
                dataPublisherSource: "Census data.",
                link:
                    "https://datasets.socialhistory.org/dataset.xhtml?persistentId=hdl:10622/LKYT53  and https://esa.un.org/unpd/wpp/Download/Standard/Population/",
                retrievedData: "",
                additionalInfo:
                    "For historical data up until 1949, Clio-Infra's dataset compiled by Zijdeman and Ribeira da Silva (2015) was used. Further information can be found using this link: https://datasets.socialhistory.org/dataset.xhtml?persistentId=hdl:10622/LKYT53. \nData from 1950 onward uses the UN Population Division data, further information can be found at https://esa.un.org/unpd/wpp/Download/Standard/Population/"
            }
        }
    },
    entityKey: {
        "1": { name: "United Kingdom", code: "GBR" }
    }
}

// Wrapper for ChartView that uses css on figure element to determine the bounds
@observer
class ChartStoryView extends React.Component {
    base: React.RefObject<HTMLDivElement> = React.createRef()
    @observable.ref bounds?: Bounds

    @action.bound calcBounds() {
        this.bounds = Bounds.fromRect(
            this.base.current!.getBoundingClientRect()
        )
    }

    componentDidMount() {
        window.addEventListener("resize", this.calcBounds)
        this.calcBounds()
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.calcBounds)
    }

    render() {
        const chart = new ChartConfig(
            {
                hasMapTab: true,
                dimensions: [{ property: "y", variableId: 66287, display: {} }]
            } as ChartConfigProps,
            {}
        )

        chart.receiveData(chartViewData as any)

        return (
            <figure
                style={{ height: "600px" }}
                data-grapher-src
                ref={this.base}
            >
                {this.bounds && (
                    <ChartView chart={chart} bounds={this.bounds} />
                )}
            </figure>
        )
    }
}

export default {
    title: "ChartView",
    component: ChartView
}

export const Default = () => <ChartStoryView />
