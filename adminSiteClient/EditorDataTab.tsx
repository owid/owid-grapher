import * as React from "react"
import {
    differenceOfSets,
    moveArrayItemToIndex,
    omit,
    sortBy,
} from "@ourworldindata/utils"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import cx from "classnames"
import {
    EntitySelectionMode,
    MissingDataStrategy,
    EntityName,
    SeriesName,
} from "@ourworldindata/types"
import { GrapherState } from "@ourworldindata/grapher"
import { ColorBox, SelectField, Section, FieldsRow } from "./Forms.js"
import {
    faArrowsAltV,
    faLink,
    faTimes,
    faUnlink,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    DragDropContext,
    Draggable,
    Droppable,
    DropResult,
} from "react-beautiful-dnd"
import { AbstractChartEditor } from "./AbstractChartEditor.js"

interface EntityListItemProps extends React.HTMLProps<HTMLDivElement> {
    grapherState: GrapherState
    entityName: EntityName
    onRemove?: () => void
}

interface SeriesListItemProps extends React.HTMLProps<HTMLDivElement> {
    seriesName: SeriesName
    isValid?: boolean
    onRemove?: () => void
}

@observer
class EntityListItem extends React.Component<EntityListItemProps> {
    @observable.ref isChoosingColor: boolean = false

    @computed get table() {
        return this.props.grapherState.table
    }

    @computed get color() {
        return this.table.getColorForEntityName(this.props.entityName)
    }

    @action.bound onColor(color: string | undefined) {
        const { grapherState } = this.props
        grapherState.selectedEntityColors[this.props.entityName] = color
        grapherState.legacyConfigAsAuthored.selectedEntityColors = {
            ...grapherState.legacyConfigAsAuthored.selectedEntityColors,
            [this.props.entityName]: color,
        }

        grapherState.seriesColorMap?.clear()
        // TODO: 2025-01-05 Daniel we used to rebuild the table here but that
        // was AFAIK only because scatter and marimekko charts need the color
        // column to be updated. Move this merge logic into scatter and marimekko
        // table transforms instead?
        // grapherState.rebuildInputOwidTable()
    }

    @action.bound onRemove() {
        this.props.onRemove?.()
    }

    render() {
        const { props, color } = this
        const { entityName, grapherState } = props
        const rest = omit(props, ["entityName", "onRemove", "grapherState"])

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
                    <ColorBox
                        color={color}
                        onColor={this.onColor}
                        showLineChartColors={grapherState.isLineChart}
                    />
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
class SeriesListItem extends React.Component<SeriesListItemProps> {
    @action.bound onRemove() {
        this.props.onRemove?.()
    }

    render() {
        const { props } = this
        const { seriesName, isValid } = props
        const rest = omit(props, ["seriesName", "isValid", "onRemove"])

        const className = cx("ListItem", "list-group-item", {
            invalid: !isValid,
        })
        const annotation = !isValid ? "(not plotted)" : ""

        return (
            <div className={className} key={seriesName} {...rest}>
                <div>
                    {seriesName} {annotation}
                </div>
                <div className="clickable" onClick={this.onRemove}>
                    <FontAwesomeIcon icon={faTimes} />
                </div>
            </div>
        )
    }
}

@observer
export class EntitySelectionSection extends React.Component<{
    editor: AbstractChartEditor
}> {
    @observable.ref dragKey?: EntityName

    @computed get editor() {
        return this.props.editor
    }

    @action.bound onAddKey(entityName: EntityName) {
        this.editor.grapherState.selection.selectEntity(entityName)
        this.editor.removeInvalidFocusedSeriesNames()
    }

    @action.bound onRemoveKey(entityName: EntityName) {
        this.editor.grapherState.selection.deselectEntity(entityName)
        this.editor.removeInvalidFocusedSeriesNames()
    }

    @action.bound onDragEnd(result: DropResult) {
        const { selection } = this.editor.grapherState
        const { source, destination } = result
        if (!destination) return

        const newSelection = moveArrayItemToIndex(
            selection.selectedEntityNames,
            source.index,
            destination.index
        )
        selection.setSelectedEntities(newSelection)
    }

    @action.bound setEntitySelectionToParentValue() {
        const { grapherState, activeParentConfig } = this.editor
        if (!activeParentConfig || !activeParentConfig.selectedEntityNames)
            return
        grapherState.selection.setSelectedEntities(
            activeParentConfig.selectedEntityNames
        )
        this.editor.removeInvalidFocusedSeriesNames()
    }

    render() {
        const { editor } = this
        const { grapherState } = editor
        const { selection } = grapherState
        const { unselectedEntityNames, selectedEntityNames } = selection

        const isEntitySelectionInherited = editor.isPropertyInherited(
            "selectedEntityNames"
        )

        return (
            <Section name="Data to show">
                <FieldsRow>
                    <SelectField
                        onValue={this.onAddKey}
                        value="Select data"
                        options={["Select data"]
                            .concat(unselectedEntityNames)
                            .map((key) => ({ value: key }))}
                    />
                    {editor.couldPropertyBeInherited("selectedEntityNames") && (
                        <button
                            className="btn btn-outline-secondary"
                            type="button"
                            style={{ maxWidth: "min-content" }}
                            title="Reset to parent selection"
                            onClick={this.setEntitySelectionToParentValue}
                            disabled={isEntitySelectionInherited}
                        >
                            <FontAwesomeIcon
                                icon={
                                    isEntitySelectionInherited
                                        ? faLink
                                        : faUnlink
                                }
                            />
                        </button>
                    )}
                </FieldsRow>
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
                                                    <EntityListItem
                                                        key={entityName}
                                                        grapherState={
                                                            grapherState
                                                        }
                                                        entityName={entityName}
                                                        onRemove={() =>
                                                            this.onRemoveKey(
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
                {isEntitySelectionInherited && (
                    <p style={{ marginTop: "0.5em" }}>
                        <i>
                            The entity selection is currently inherited from the
                            parent indicator.
                        </i>
                    </p>
                )}
            </Section>
        )
    }
}

@observer
export class FocusSection extends React.Component<{
    editor: AbstractChartEditor
}> {
    @computed get editor() {
        return this.props.editor
    }

    @action.bound addToFocusedSeries(seriesName: SeriesName) {
        this.editor.grapherState.focusArray.add(seriesName)
    }

    @action.bound removeFromFocusedSeries(seriesName: SeriesName) {
        this.editor.grapherState.focusArray.remove(seriesName)
    }

    @action.bound setFocusedSeriesNamesToParentValue() {
        const { grapherState, activeParentConfig } = this.editor
        if (!activeParentConfig || !activeParentConfig.focusedSeriesNames)
            return
        grapherState.focusArray.clearAllAndAdd(
            ...activeParentConfig.focusedSeriesNames
        )
        this.editor.removeInvalidFocusedSeriesNames()
    }

    render() {
        const { editor } = this
        const { grapherState } = editor

        const isFocusInherited =
            editor.isPropertyInherited("focusedSeriesNames")

        const focusedSeriesNameSet = grapherState.focusArray.seriesNameSet
        const focusedSeriesNames = grapherState.focusArray.seriesNames

        // series available to highlight are those that are currently plotted
        const seriesNameSet = new Set(grapherState.chartSeriesNames)
        const availableSeriesNameSet = differenceOfSets([
            seriesNameSet,
            focusedSeriesNameSet,
        ])

        // focusing only makes sense for two or more plotted series
        if (focusedSeriesNameSet.size === 0 && availableSeriesNameSet.size < 2)
            return null

        const availableSeriesNames: SeriesName[] = sortBy(
            Array.from(availableSeriesNameSet)
        )

        const invalidFocusedSeriesNames = differenceOfSets([
            focusedSeriesNameSet,
            seriesNameSet,
        ])

        return (
            <Section name="Data to highlight">
                <FieldsRow>
                    <SelectField
                        onValue={this.addToFocusedSeries}
                        value="Select data"
                        options={["Select data"]
                            .concat(availableSeriesNames)
                            .map((key) => ({ value: key }))}
                    />
                    {editor.couldPropertyBeInherited("focusedSeriesNames") && (
                        <button
                            className="btn btn-outline-secondary"
                            type="button"
                            style={{ maxWidth: "min-content" }}
                            title="Reset to parent focus"
                            onClick={this.setFocusedSeriesNamesToParentValue}
                            disabled={isFocusInherited}
                        >
                            <FontAwesomeIcon
                                icon={isFocusInherited ? faLink : faUnlink}
                            />
                        </button>
                    )}
                </FieldsRow>
                {focusedSeriesNames.map((seriesName) => (
                    <SeriesListItem
                        key={seriesName}
                        seriesName={seriesName}
                        isValid={!invalidFocusedSeriesNames.has(seriesName)}
                        onRemove={() =>
                            this.removeFromFocusedSeries(seriesName)
                        }
                    />
                ))}
            </Section>
        )
    }
}

@observer
class MissingDataSection<
    Editor extends AbstractChartEditor,
> extends React.Component<{ editor: Editor }> {
    @computed get grapherState() {
        return this.props.editor.grapherState
    }

    get missingDataStrategyOptions(): {
        value: MissingDataStrategy
        label: string
    }[] {
        const missingDataStrategyLabels = {
            [MissingDataStrategy.auto]: "Automatic",
            [MissingDataStrategy.hide]: "Hide entities with missing data",
            [MissingDataStrategy.show]: "Show entities with missing data",
        }

        return Object.values(MissingDataStrategy).map((strategy) => {
            return {
                value: strategy,
                label: missingDataStrategyLabels[strategy],
            }
        })
    }

    @action.bound onSelectMissingDataStrategy(value: string | undefined) {
        this.grapherState.missingDataStrategy = value as MissingDataStrategy
    }

    render() {
        const { grapherState } = this

        return (
            <Section name="Missing data">
                <SelectField
                    label="Missing data strategy (for when one or more variables are missing for an entity)"
                    value={grapherState.missingDataStrategy}
                    options={this.missingDataStrategyOptions}
                    onValue={this.onSelectMissingDataStrategy}
                />
            </Section>
        )
    }
}

@observer
export class EditorDataTab<
    Editor extends AbstractChartEditor,
> extends React.Component<{ editor: Editor }> {
    render() {
        const { editor } = this.props
        const { grapherState, features } = editor

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
                                    grapherState.addCountryMode ===
                                    EntitySelectionMode.MultipleEntities
                                }
                                onChange={() =>
                                    (grapherState.addCountryMode =
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
                                    grapherState.addCountryMode ===
                                    EntitySelectionMode.SingleEntity
                                }
                                onChange={() =>
                                    (grapherState.addCountryMode =
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
                                    grapherState.addCountryMode ===
                                    EntitySelectionMode.Disabled
                                }
                                onChange={() =>
                                    (grapherState.addCountryMode =
                                        EntitySelectionMode.Disabled)
                                }
                            />
                            User cannot change/add data
                        </label>
                    </div>
                </Section>
                <EntitySelectionSection editor={editor} />
                {features.canHighlightSeries && (
                    <FocusSection editor={editor} />
                )}
                {features.canSpecifyMissingDataStrategy && (
                    <MissingDataSection editor={this.props.editor} />
                )}
            </div>
        )
    }
}
