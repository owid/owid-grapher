import * as React from "react"
import { CountryPicker } from "grapher/controls/countryPicker/CountryPicker"
import { BlankOwidTable } from "coreTable/OwidTable"
import { observer } from "mobx-react"
import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { ColumnSlug, SortOrder } from "coreTable/CoreTableConstants"
import { EntityName, OwidTableSlugs } from "coreTable/OwidTableConstants"
import { CountryPickerManager } from "grapher/controls/countryPicker/CountryPickerConstants"
import { observable } from "mobx"

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

const defaultSlugs = [
    OwidTableSlugs.entityName,
    SampleColumnSlugs.GDP,
    SampleColumnSlugs.Population,
]

// A stub class for testing
@observer
class SomeThingWithACountryPicker
    extends React.Component<{
        pickerSlugs?: ColumnSlug[]
        selection?: EntityName[]
    }>
    implements CountryPickerManager {
    table = SynthesizeGDPTable({ entityCount: 30 }, 1).setSelectedEntities(
        this.props.selection ?? []
    )

    @observable countryPickerMetric?: ColumnSlug
    @observable countryPickerSort?: SortOrder

    render() {
        return (
            <CountryPickerHolder>
                <CountryPicker
                    table={this.table}
                    requiredColumnSlugs={defaultSlugs}
                    pickerColumnSlugs={this.props.pickerSlugs}
                    manager={this}
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
        <CountryPicker table={BlankOwidTable()} />
    </CountryPickerHolder>
)

export const WithChoices = () => <SomeThingWithACountryPicker />

export const WithPickerMetricsChoices = () => (
    <SomeThingWithACountryPicker pickerSlugs={defaultSlugs} />
)

export const WithExistingSelectionChoices = () => (
    <SomeThingWithACountryPicker
        pickerSlugs={defaultSlugs}
        selection={["Japan", "Samoa"]}
    />
)
