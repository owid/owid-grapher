import * as React from "react"
import { CountryPicker } from "grapher/controls/CountryPicker"
import { OwidTable } from "coreTable/OwidTable"
import { observable, action } from "mobx"
import { observer } from "mobx-react"

class CountryPickerHolder extends React.Component {
    render() {
        return (
            <div
                style={{
                    padding: "20px",
                    height: "500px",
                    width: "300px",
                    display: "grid",
                }}
            >
                {this.props.children}
            </div>
        )
    }
}

// A stub class for testing
@observer
class CountryPickerIntegrated extends React.Component {
    table = OwidTable.fromDelimited(`entityName,entityId,entityCode,pop,gdp
usa,1,usa,100,200
canada,2,can,200,300
france,3,fra,,400`)

    @observable selected: string[] = ["canada"]

    @action.bound clearSelection() {
        this.selected = []
    }

    @action.bound toggleSelection(name: string) {
        this.selected.includes(name)
            ? (this.selected = this.selected.filter((i) => i !== name))
            : this.selected.push(name)
    }

    render() {
        return (
            <CountryPickerHolder>
                <CountryPicker
                    table={this.table}
                    countriesMustHaveColumns={["pop", "gdp"]}
                />
            </CountryPickerHolder>
        )
    }
}

export default {
    title: "CountryPicker",
    component: CountryPicker,
}

export const Empty = () => (
    <CountryPickerHolder>
        <CountryPicker />
    </CountryPickerHolder>
)

export const WithChoices = () => <CountryPickerIntegrated />
