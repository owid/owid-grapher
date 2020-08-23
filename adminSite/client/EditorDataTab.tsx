import * as React from "react"
import { clone, map } from "charts/utils/Util"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import { ChartConfig } from "charts/core/ChartConfig"
import { EntityDimensionKey } from "charts/core/ChartConstants"
import {
    EditableList,
    EditableListItem,
    EditableListItemProps,
    ColorBox,
    SelectField,
    Section
} from "./Forms"
import { ChartEditor } from "./ChartEditor"
import { faArrowsAltV } from "@fortawesome/free-solid-svg-icons/faArrowsAltV"
import { faTimes } from "@fortawesome/free-solid-svg-icons/faTimes"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

interface EntityDimensionKeyItemProps extends EditableListItemProps {
    chart: ChartConfig
    entityDimensionKey: EntityDimensionKey
}

@observer
class EntityDimensionKeyItem extends React.Component<
    EntityDimensionKeyItemProps
> {
    @observable.ref isChoosingColor: boolean = false

    @computed get color() {
        return this.props.chart.data.keyColors[this.props.entityDimensionKey]
    }

    @action.bound onColor(color: string | undefined) {
        this.props.chart.data.setKeyColor(this.props.entityDimensionKey, color)
    }

    @action.bound onRemove() {
        this.props.chart.data.deselect(this.props.entityDimensionKey)
    }

    render() {
        const { props, color } = this
        const { chart, entityDimensionKey, ...rest } = props
        const meta = chart.data.entityDimensionMap.get(entityDimensionKey)

        return (
            <EditableListItem
                className="EntityDimensionKeyItem"
                key={entityDimensionKey}
                {...rest}
            >
                <div>
                    <div>
                        <FontAwesomeIcon icon={faArrowsAltV} />
                    </div>
                    <ColorBox color={color} onColor={this.onColor} />
                    {meta ? meta.fullLabel : entityDimensionKey}
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
    @observable.ref dragKey?: EntityDimensionKey

    @action.bound onAddKey(key: EntityDimensionKey) {
        this.props.chart.data.selectEntityDimensionKey(key)
    }

    @action.bound onStartDrag(key: EntityDimensionKey) {
        this.dragKey = key

        const onDrag = action(() => {
            this.dragKey = undefined
            window.removeEventListener("mouseup", onDrag)
        })

        window.addEventListener("mouseup", onDrag)
    }

    @action.bound onMouseEnter(targetKey: EntityDimensionKey) {
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
                    {map(selectedKeys, key => (
                        <EntityDimensionKeyItem
                            key={key}
                            chart={chart}
                            entityDimensionKey={key}
                            onMouseDown={() => this.onStartDrag(key)}
                            onMouseEnter={() => this.onMouseEnter(key)}
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
                                onChange={() =>
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
                                onChange={() =>
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
                                onChange={() =>
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
