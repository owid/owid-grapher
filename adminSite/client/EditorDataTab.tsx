import * as React from "react"
import { clone, map } from "charts/utils/Util"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import { Grapher } from "charts/core/Grapher"
import { EntityDimensionKey } from "charts/core/GrapherConstants"
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
    grapher: Grapher
    entityDimensionKey: EntityDimensionKey
}

@observer
class EntityDimensionKeyItem extends React.Component<
    EntityDimensionKeyItemProps
> {
    @observable.ref isChoosingColor: boolean = false

    @computed get color() {
        return this.props.grapher.keyColors[this.props.entityDimensionKey]
    }

    @action.bound onColor(color: string | undefined) {
        this.props.grapher.setKeyColor(this.props.entityDimensionKey, color)
    }

    @action.bound onRemove() {
        this.props.grapher.deselect(this.props.entityDimensionKey)
    }

    render() {
        const { props, color } = this
        const { grapher, entityDimensionKey, ...rest } = props
        const meta = grapher.entityDimensionMap.get(entityDimensionKey)

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
class KeysSection extends React.Component<{ grapher: Grapher }> {
    @observable.ref dragKey?: EntityDimensionKey

    @action.bound onAddKey(key: EntityDimensionKey) {
        this.props.grapher.selectEntityDimensionKey(key)
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

        const selectedKeys = clone(this.props.grapher.selectedKeys)
        const dragIndex = selectedKeys.indexOf(this.dragKey)
        const targetIndex = selectedKeys.indexOf(targetKey)
        selectedKeys.splice(dragIndex, 1)
        selectedKeys.splice(targetIndex, 0, this.dragKey)
        this.props.grapher.selectedKeys = selectedKeys
    }

    render() {
        const { grapher } = this.props
        const { selectedKeys, remainingKeys } = grapher

        const keyLabels = remainingKeys.map(
            key => grapher.lookupKey(key).fullLabel
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
                            grapher={grapher}
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
        const { grapher } = editor

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
                                checked={
                                    grapher.addCountryMode === "add-country"
                                }
                                onChange={() =>
                                    (grapher.addCountryMode = "add-country")
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
                                    grapher.addCountryMode === "change-country"
                                }
                                onChange={() =>
                                    (grapher.addCountryMode = "change-country")
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
                                checked={grapher.addCountryMode === "disabled"}
                                onChange={() =>
                                    (grapher.addCountryMode = "disabled")
                                }
                            />
                            User cannot change/add data
                        </label>
                    </div>
                </Section>
                <KeysSection grapher={editor.grapher} />
            </div>
        )
    }
}
