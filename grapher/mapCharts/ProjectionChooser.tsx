import React from "react"
import { computed, action, makeObservable } from "mobx"
import { observer } from "mobx-react"
import Select from "react-select"
import { MapProjectionName, MapProjectionLabels } from "./MapProjections.js"
import { getStylesForTargetHeight } from "../../clientUtils/react-select.js"

interface ProjectionChooserEntry {
    label: string
    value: MapProjectionName
}

export const ProjectionChooser = observer(
    class ProjectionChooser extends React.Component<{
        value: string
        onChange: (value: MapProjectionName) => void
    }> {
        constructor(props: {
            value: string
            onChange: (value: MapProjectionName) => void
        }) {
            super(props)

            makeObservable(this, {
                onChange: action.bound,
                options: computed,
            })
        }

        onChange(selected: ProjectionChooserEntry | null): void {
            if (selected) this.props.onChange(selected.value)
        }

        get options(): { value: MapProjectionName; label: string }[] {
            return Object.values(MapProjectionName).map((projectName) => {
                return {
                    value: projectName,
                    label: MapProjectionLabels[projectName],
                }
            })
        }

        render(): JSX.Element {
            const { value } = this.props

            const style: React.CSSProperties = {
                fontSize: "0.75rem",
                pointerEvents: "auto",
            }

            return (
                <div style={style}>
                    <Select
                        options={this.options}
                        onChange={this.onChange}
                        value={this.options.find((opt) => opt.value === value)}
                        menuPlacement="bottom"
                        components={{
                            IndicatorSeparator: null,
                        }}
                        styles={getStylesForTargetHeight(22)}
                        isSearchable={false}
                    />
                </div>
            )
        }
    }
)
