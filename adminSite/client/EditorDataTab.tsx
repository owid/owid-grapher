import * as React from "react"
import { clone } from "grapher/utils/Util"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import { Grapher } from "grapher/core/Grapher"
import {
    EditableList,
    EditableListItem,
    EditableListItemProps,
    ColorBox,
    SelectField,
    Section,
} from "./Forms"
import { ChartEditor } from "./ChartEditor"
import { faArrowsAltV } from "@fortawesome/free-solid-svg-icons/faArrowsAltV"
import { faTimes } from "@fortawesome/free-solid-svg-icons/faTimes"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { EntityName } from "owidTable/OwidTableConstants"

interface EntityItemProps extends EditableListItemProps {
    grapher: Grapher
    entityName: EntityName
}

@observer
class EntityItem extends React.Component<EntityItemProps> {
    @observable.ref isChoosingColor: boolean = false

    @computed get table() {
        return this.props.grapher.table
    }

    @computed get color() {
        return this.table.getColorForEntityName(this.props.entityName)
    }

    @action.bound onColor(color: string | undefined) {
        // todo
        // this.props.grapher.setKeyColor(this.props.entityName, color)
    }

    @action.bound onRemove() {
        // todo
        // this.props.grapher.deselect(this.props.entityName)
    }

    render() {
        const { props, color } = this
        const { entityName, ...rest } = props

        return (
            <EditableListItem
                className="EditableListItem"
                key={entityName}
                {...rest}
            >
                <div>
                    <div>
                        <FontAwesomeIcon icon={faArrowsAltV} />
                    </div>
                    <ColorBox color={color} onColor={this.onColor} />
                    {entityName}
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
    @observable.ref dragKey?: EntityName

    @action.bound onAddKey(entityName: EntityName) {
        this.props.grapher.table.selectEntity(entityName)
    }

    @action.bound onStartDrag(key: EntityName) {
        this.dragKey = key

        const onDrag = action(() => {
            this.dragKey = undefined
            window.removeEventListener("mouseup", onDrag)
        })

        window.addEventListener("mouseup", onDrag)
    }

    @action.bound onMouseEnter(targetKey: EntityName) {
        if (!this.dragKey || targetKey === this.dragKey) return

        const selectedKeys = clone(this.props.grapher.table.selectedEntityNames)
        const dragIndex = selectedKeys.indexOf(this.dragKey)
        const targetIndex = selectedKeys.indexOf(targetKey)
        selectedKeys.splice(dragIndex, 1)
        selectedKeys.splice(targetIndex, 0, this.dragKey)
        this.props.grapher.table.setSelectedEntities(selectedKeys)
    }

    render() {
        const { grapher } = this.props
        const { table } = grapher
        const { unselectedEntityNames, selectedEntityNames } = table

        return (
            <Section name="Data to show">
                <SelectField
                    onValue={this.onAddKey}
                    value="Select data"
                    options={["Select data"].concat(unselectedEntityNames)}
                    optionLabels={["Select data"].concat(unselectedEntityNames)}
                />
                <EditableList>
                    {selectedEntityNames.map((key) => (
                        <EntityItem
                            key={key}
                            grapher={grapher}
                            entityName={key}
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
