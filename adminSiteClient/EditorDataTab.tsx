import React from "react"
import { moveArrayItemToIndex, omit } from "@ourworldindata/utils"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import { Grapher, EntitySelectionMode } from "@ourworldindata/grapher"
import { ColorBox, SelectField, Section } from "./Forms.js"
import { ChartEditor } from "./ChartEditor.js"
import { faArrowsAltV } from "@fortawesome/free-solid-svg-icons/faArrowsAltV"
import { faTimes } from "@fortawesome/free-solid-svg-icons/faTimes"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { EntityName } from "@ourworldindata/core-table"
import {
    DragDropContext,
    Draggable,
    Droppable,
    DropResult,
} from "react-beautiful-dnd"

interface EntityItemProps extends React.HTMLProps<HTMLDivElement> {
    grapher: Grapher
    entityName: EntityName
    onRemove?: () => void
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
        const { grapher } = this.props
        grapher.selectedEntityColors[this.props.entityName] = color
        grapher.legacyConfigAsAuthored.selectedEntityColors = {
            ...grapher.legacyConfigAsAuthored.selectedEntityColors,
            [this.props.entityName]: color,
        }

        grapher.seriesColorMap?.clear()
        grapher.rebuildInputOwidTable()
    }

    @action.bound onRemove() {
        this.props.onRemove?.()
    }

    render() {
        const { props, color } = this
        const { entityName } = props
        const rest = omit(props, ["entityName", "onRemove", "grapher"])

        return (
            <div
                className="list-group-item EditableListItem"
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
            </div>
        )
    }
}

@observer
export class KeysSection extends React.Component<{ grapher: Grapher }> {
    @observable.ref dragKey?: EntityName

    @action.bound onAddKey(entityName: EntityName) {
        this.props.grapher.selection.selectEntity(entityName)
    }

    @action.bound onDragEnd(result: DropResult) {
        const { selection } = this.props.grapher
        const { source, destination } = result
        if (!destination) return

        const newSelection = moveArrayItemToIndex(
            selection.selectedEntityNames,
            source.index,
            destination.index
        )
        selection.setSelectedEntities(newSelection)
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
                    options={["Select data"]
                        .concat(unselectedEntityNames)
                        .map((key) => ({ value: key }))}
                />
                <DragDropContext onDragEnd={this.onDragEnd}>
                    <Droppable droppableId="droppable">
                        {(provided) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                            >
                                {selectedEntityNames.map(
                                    (entityName, index) => (
                                        <Draggable
                                            key={entityName}
                                            index={index}
                                            draggableId={entityName}
                                        >
                                            {(provided) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                >
                                                    <EntityItem
                                                        key={entityName}
                                                        grapher={grapher}
                                                        entityName={entityName}
                                                        onRemove={() =>
                                                            selection.deselectEntity(
                                                                entityName
                                                            )
                                                        }
                                                    />
                                                </div>
                                            )}
                                        </Draggable>
                                    )
                                )}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
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
