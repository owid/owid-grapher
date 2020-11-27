import * as React from "react"
import { clone } from "clientUtils/Util"
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
import { EntityName } from "coreTable/OwidTableConstants"
import { EntitySelectionMode } from "grapher/core/GrapherConstants"

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
        this.props.grapher.selection.selectEntity(entityName)
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

        const selectedKeys = clone(
            this.props.grapher.selection.selectedEntityNames
        )
        const dragIndex = selectedKeys.indexOf(this.dragKey)
        const targetIndex = selectedKeys.indexOf(targetKey)
        selectedKeys.splice(dragIndex, 1)
        selectedKeys.splice(targetIndex, 0, this.dragKey)
        this.props.grapher.selection.setSelectedEntities(selectedKeys)
    }

    render() {
        const { grapher } = this.props
        const { selection } = grapher
        const { unselectedEntityNames, selectedEntityNames } = selection

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
                                value={EntitySelectionMode.MultipleEntities}
                                checked={
                                    grapher.addCountryMode ===
                                    EntitySelectionMode.MultipleEntities
                                }
                                onChange={() =>
                                    (grapher.addCountryMode =
                                        EntitySelectionMode.MultipleEntities)
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
                                value={EntitySelectionMode.SingleEntity}
                                checked={
                                    grapher.addCountryMode ===
                                    EntitySelectionMode.SingleEntity
                                }
                                onChange={() =>
                                    (grapher.addCountryMode =
                                        EntitySelectionMode.SingleEntity)
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
                                value={EntitySelectionMode.Disabled}
                                checked={
                                    grapher.addCountryMode ===
                                    EntitySelectionMode.Disabled
                                }
                                onChange={() =>
                                    (grapher.addCountryMode =
                                        EntitySelectionMode.Disabled)
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
