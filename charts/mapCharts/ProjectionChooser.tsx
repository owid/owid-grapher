import * as React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import Select, { ValueType } from "react-select"
import { worldRegions, labelsByRegion } from "./WorldRegions"
import { first } from "../Util"
import { Bounds } from "../Bounds"
import { MapProjection } from "./MapProjection"
import { asArray, getStylesForTargetHeight } from "utils/client/react-select"

interface ProjectionChooserEntry {
    label: string
    value: MapProjection
}

@observer
export class ProjectionChooser extends React.Component<{
    bounds: Bounds
    value: string
    onChange: (value: MapProjection) => void
}> {
    @action.bound onChange(selected: ValueType<ProjectionChooserEntry>) {
        const selectedValue = first(asArray(selected))?.value
        if (selectedValue) this.props.onChange(selectedValue)
    }

    @computed get options() {
        return worldRegions.map(region => {
            return {
                value: region,
                label: labelsByRegion[region]
            }
        })
    }

    render() {
        const { bounds, value } = this.props

        const style: React.CSSProperties = {
            position: "absolute",
            fontSize: "0.75rem",
            ...bounds.toCSS()
        }

        return (
            <div style={style}>
                <Select
                    options={this.options}
                    onChange={this.onChange}
                    value={this.options.find(opt => opt.value === value)}
                    menuPlacement="bottom"
                    components={{
                        IndicatorSeparator: null
                    }}
                    styles={getStylesForTargetHeight(22)}
                    isSearchable={false}
                />
            </div>
        )
    }
}
