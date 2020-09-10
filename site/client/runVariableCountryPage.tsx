import * as React from "react"
import ReactDOM from "react-dom"
import { clone } from "grapher/utils/Util"
import { computed, IReactionDisposer, observable } from "mobx"
import { Grapher } from "grapher/core/Grapher"
import { GrapherFigureView } from "./GrapherFigureView"
import { observer } from "mobx-react"
import { VariableCountryPageProps } from "site/server/views/VariableCountryPageProps"

@observer
class ClientVariableCountryPage extends React.Component<{
    countryPageProps: VariableCountryPageProps
}> {
    @observable.ref chart?: Grapher

    @computed get chartConfig() {
        const { variable, country } = this.props.countryPageProps
        return {
            yAxis: { min: 0 },
            map: { variableId: variable.id },
            tab: "chart",
            hasMapTab: true,
            dimensions: [
                {
                    property: "y",
                    variableId: variable.id,
                    display: clone(variable.display),
                },
            ],
            selectedData: [
                {
                    entityId: country.id,
                    index: 0,
                },
            ],
        }
    }

    dispose!: IReactionDisposer
    componentDidMount() {
        this.chart = new Grapher(this.chartConfig as any, {
            isEmbed: true,
        })
    }

    render() {
        const { variable, country } = this.props.countryPageProps
        return (
            <React.Fragment>
                <h1>
                    {variable.name} in {country.name}
                </h1>
                {this.chart && <GrapherFigureView grapher={this.chart} />}
            </React.Fragment>
        )
    }
}

export function runVariableCountryPage(props: VariableCountryPageProps) {
    ReactDOM.render(
        <ClientVariableCountryPage countryPageProps={props} />,
        document.querySelector("main")
    )
}
