import { faArrowsAltV } from "@fortawesome/free-solid-svg-icons/faArrowsAltV"
import { faTimes } from "@fortawesome/free-solid-svg-icons/faTimes"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { ChartConfig } from "charts/ChartConfig"
import { DataKey } from "charts/DataKey"
import { clone, map } from "charts/Util"
import { action, computed, observable } from "mobx"
import { observer } from "mobx-react"
import * as React from "react"
import { ChartEditor } from "./ChartEditor"
import {
    ColorBox,
    EditableList,
    EditableListItem,
    EditableListItemProps,
    Section,
    SelectField
} from "./Forms"

interface DataKeyItemProps extends EditableListItemProps {
    chart: ChartConfig
    datakey: DataKey
}

@observer
class DataKeyItem extends React.Component<DataKeyItemProps> {
    @observable.ref isChoosingColor: boolean = false

    @computed get color() {
        return this.props.chart.data.keyColors[this.props.datakey]
    }

    @action.bound onColor(color: string | undefined) {
        this.props.chart.data.setKeyColor(this.props.datakey, color)
    }

    @action.bound onRemove() {
        this.props.chart.data.selectedKeys = this.props.chart.data.selectedKeys.filter(
            e => e !== this.props.datakey
        )
    }

    render() {
        const { props, color } = this
        const { chart, datakey, ...rest } = props
        const meta = chart.data.keyData.get(datakey)

        return (
            <EditableListItem className="DataKeyItem" key={datakey} {...rest}>
                <div>
                    <div>
                        <FontAwesomeIcon icon={faArrowsAltV} />
                    </div>
                    <ColorBox color={color} onColor={this.onColor} />
                    {meta ? meta.fullLabel : datakey}
                </div>
                <div className="clickable" onClick={this.onRemove}>
                    <FontAwesomeIcon icon={faTimes} />
                </div>
            </EditableListItem>
        )
    }
}

@observer
class KeysSection extends React.Component<{ chart: ChartConfig }> {
    @observable.ref dragKey?: DataKey

    @action.bound onAddKey(key: string) {
        this.props.chart.data.selectKey(key)
    }

    @action.bound onStartDrag(key: DataKey) {
        this.dragKey = key

        const onDrag = action(() => {
            this.dragKey = undefined
            window.removeEventListener("mouseup", onDrag)
        })

        window.addEventListener("mouseup", onDrag)
    }

    @action.bound onMouseEnter(targetKey: DataKey) {
        if (!this.dragKey || targetKey === this.dragKey) return

        const selectedKeys = clone(this.props.chart.data.selectedKeys)
        const dragIndex = selectedKeys.indexOf(this.dragKey)
        const targetIndex = selectedKeys.indexOf(targetKey)
        selectedKeys.splice(dragIndex, 1)
        selectedKeys.splice(targetIndex, 0, this.dragKey)
        this.props.chart.data.selectedKeys = selectedKeys
    }

    render() {
        const { chart } = this.props
        const { selectedKeys, remainingKeys } = chart.data

        const keyLabels = remainingKeys.map(
            key => chart.data.lookupKey(key).fullLabel
        )

        return (
            <Section name="Data to show">
                <SelectField
                    onValue={this.onAddKey}
                    value="Select data"
                    options={["Select data"].concat(remainingKeys)}
                    optionLabels={["Select data"].concat(keyLabels)}
                />
                <EditableList>
                    {map(selectedKeys, datakey => (
                        <DataKeyItem
                            key={datakey}
                            chart={chart}
                            datakey={datakey}
                            onMouseDown={() => this.onStartDrag(datakey)}
                            onMouseEnter={() => this.onMouseEnter(datakey)}
                        />
                    ))}
                </EditableList>
            </Section>
        )
    }
}

@observer
export class EditorDataTab extends React.Component<{ editor: ChartEditor }> {
    render() {
        const { editor } = this.props
        const { chart } = editor

        return (
            <div className="EditorDataTab">
                <Section name="Can user add/change data?">
                    <div className="form-check">
                        <label className="form-check-label">
                            <input
                                className="form-check-input"
                                type="radio"
                                name="add-country-mode"
                                value="add-country"
                                checked={chart.addCountryMode === "add-country"}
                                onChange={_ =>
                                    (chart.props.addCountryMode = "add-country")
                                }
                            />
                            User can add and remove data
                        </label>
                    </div>
                    <div className="form-check">
                        <label className="form-check-label">
                            <input
                                className="form-check-input"
                                type="radio"
                                name="add-country-mode"
                                value="change-country"
                                checked={
                                    chart.addCountryMode === "change-country"
                                }
                                onChange={_ =>
                                    (chart.props.addCountryMode =
                                        "change-country")
                                }
                            />
                            User can change entity
                        </label>
                    </div>
                    <div className="form-check">
                        <label className="form-check-label">
                            <input
                                className="form-check-input"
                                type="radio"
                                name="add-country-mode"
                                value="disabled"
                                checked={chart.addCountryMode === "disabled"}
                                onChange={_ =>
                                    (chart.props.addCountryMode = "disabled")
                                }
                            />
                            User cannot change/add data
                        </label>
                    </div>
                </Section>
                <KeysSection chart={editor.chart} />
            </div>
        )
    }
}
