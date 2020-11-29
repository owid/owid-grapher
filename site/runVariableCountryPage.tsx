import * as React from "react"
import ReactDOM from "react-dom"
import { clone } from "../covid/node_modules/clientUtils/Util"
import { computed, IReactionDisposer, observable } from "mobx"
import { Grapher } from "grapher/core/Grapher"
import { GrapherFigureView } from "./GrapherFigureView"
import { observer } from "mobx-react"
import { VariableCountryPageProps } from "site/server/VariableCountryPageProps"
import { GrapherInterface } from "grapher/core/GrapherInterface"

@observer
class ClientVariableCountryPage extends React.Component<{
    countryPageProps: VariableCountryPageProps
}> {
    @observable.ref grapher?: Grapher

    @computed get grapherConfig() {
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
            selectedEntityNames: [country.name],
        } as GrapherInterface
    }

    dispose!: IReactionDisposer
    componentDidMount() {
        this.grapher = new Grapher({
            ...this.grapherConfig,
            isEmbeddedInAnOwidPage: true,
        })
    }

    render() {
        const { variable, country } = this.props.countryPageProps
        return (
            <React.Fragment>
                <h1>
                    {variable.name} in {country.name}
                </h1>
                {this.grapher && <GrapherFigureView grapher={this.grapher} />}
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
