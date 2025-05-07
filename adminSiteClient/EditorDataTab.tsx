import * as React from "react"
import {
    difference,
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
import { Grapher } from "@ourworldindata/grapher"
import {
    ColorBox,
    SelectField,
    Section,
    FieldsRow,
    BindString,
} from "./Forms.js"
import {
    faArrowsAltV,
    faLink,
    faMinus,
    faTimes,
    faTrash,
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
    grapher: Grapher
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
        const { entityName, grapher } = props
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
                    <ColorBox
                        color={color}
                        onColor={this.onColor}
                        showLineChartColors={grapher.isLineChart}
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
        this.editor.grapher.selection.selectEntity(entityName)
        this.editor.removeInvalidFocusedSeriesNames()
    }

    @action.bound onRemoveKey(entityName: EntityName) {
        this.editor.grapher.selection.deselectEntity(entityName)
        this.editor.removeInvalidFocusedSeriesNames()
    }

    @action.bound onDragEnd(result: DropResult) {
        const { selection } = this.editor.grapher
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
        const { grapher, activeParentConfig } = this.editor
        if (!activeParentConfig || !activeParentConfig.selectedEntityNames)
            return
        grapher.selection.setSelectedEntities(
            activeParentConfig.selectedEntityNames
        )
        this.editor.removeInvalidFocusedSeriesNames()
    }

    render() {
        const { editor } = this
        const { grapher } = editor
        const { selection } = grapher
        const { selectedEntityNames } = selection

        const unselectedEntityNames = difference(
            grapher.availableEntityNames,
            selectedEntityNames
        )

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
                                                        grapher={grapher}
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
        this.editor.grapher.focusArray.add(seriesName)
    }

    @action.bound removeFromFocusedSeries(seriesName: SeriesName) {
        this.editor.grapher.focusArray.remove(seriesName)
    }

    @action.bound setFocusedSeriesNamesToParentValue() {
        const { grapher, activeParentConfig } = this.editor
        if (!activeParentConfig || !activeParentConfig.focusedSeriesNames)
            return
        grapher.focusArray.clearAllAndAdd(
            ...activeParentConfig.focusedSeriesNames
        )
        this.editor.removeInvalidFocusedSeriesNames()
    }

    render() {
        const { editor } = this
        const { grapher } = editor

        const isFocusInherited =
            editor.isPropertyInherited("focusedSeriesNames")

        const focusedSeriesNameSet = grapher.focusArray.seriesNameSet
        const focusedSeriesNames = grapher.focusArray.seriesNames

        // series available to highlight are those that are currently plotted
        const seriesNameSet = new Set(grapher.chartSeriesNames)
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
    @computed get grapher() {
        return this.props.editor.grapher
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
        this.grapher.missingDataStrategy = value as MissingDataStrategy
    }

    render() {
        const { grapher } = this

        return (
            <Section name="Missing data">
                <SelectField
                    label="Missing data strategy (for when one or more variables are missing for an entity)"
                    value={grapher.missingDataStrategy}
                    options={this.missingDataStrategyOptions}
                    onValue={this.onSelectMissingDataStrategy}
                />
            </Section>
        )
    }
}

@observer
class EntityFilterSection<
    Editor extends AbstractChartEditor,
> extends React.Component<{ editor: Editor }> {
    @computed private get editor(): Editor {
        return this.props.editor
    }

    @computed private get grapher(): Grapher {
        return this.editor.grapher
    }

    @computed private get includedEntityNames(): EntityName[] {
        return this.grapher.includedEntityNames ?? []
    }

    @computed private get excludedEntityNames(): EntityName[] {
        return this.grapher.excludedEntityNames ?? []
    }

    @computed private get includedEntityChoices() {
        const { inputTable, includedEntityNames = [] } = this.grapher
        return inputTable.availableEntityNames
            .filter((entityName) => !includedEntityNames.includes(entityName))
            .sort()
    }

    @computed private get excludedEntityChoices() {
        const { excludedEntityNames = [] } = this.grapher
        const availableEntityNames =
            this.includedEntityNames.length > 0
                ? this.includedEntityNames
                : this.grapher.availableEntityNames
        return availableEntityNames
            .filter((entityName) => !excludedEntityNames.includes(entityName))
            .sort()
    }

    @action.bound validateSelectionAndFocus() {
        this.editor.removeInvalidSelectedEntityNames()
        this.editor.removeInvalidFocusedSeriesNames()
    }

    @action.bound onExcludeEntity(entityName: string) {
        const { grapher } = this
        if (grapher.excludedEntityNames === undefined) {
            grapher.excludedEntityNames = []
        }

        if (!grapher.excludedEntityNames.includes(entityName))
            grapher.excludedEntityNames.push(entityName)

        this.validateSelectionAndFocus()
    }

    @action.bound onUnexcludeEntity(entityName: string) {
        const { grapher } = this
        if (!grapher.excludedEntityNames) return
        grapher.excludedEntityNames = grapher.excludedEntityNames.filter(
            (e) => e !== entityName
        )

        this.validateSelectionAndFocus()
    }

    @action.bound onIncludeEntity(entityName: string) {
        const { grapher } = this
        if (grapher.includedEntityNames === undefined) {
            grapher.includedEntityNames = []
        }

        if (!grapher.includedEntityNames.includes(entityName))
            grapher.includedEntityNames.push(entityName)

        this.validateSelectionAndFocus()
    }

    @action.bound onUnincludeEntity(entityName: string) {
        const { grapher } = this
        if (!grapher.includedEntityNames) return
        grapher.includedEntityNames = grapher.includedEntityNames.filter(
            (e) => e !== entityName
        )

        this.validateSelectionAndFocus()
    }

    @action.bound onClearExcludedEntities() {
        const { grapher } = this
        grapher.excludedEntityNames = []
        this.validateSelectionAndFocus()
    }

    @action.bound onClearIncludedEntities() {
        const { grapher } = this
        grapher.includedEntityNames = []
        this.validateSelectionAndFocus()
    }

    render() {
        const { includedEntityChoices, excludedEntityChoices } = this
        return (
            <Section name="Manual entity selection">
                <SelectField
                    label={
                        "Explicit start selection (leave empty to show all entities)"
                    }
                    placeholder={"Select an entity to include"}
                    value={undefined}
                    onValue={(v) => v && this.onIncludeEntity(v)}
                    options={includedEntityChoices.map((entry) => ({
                        value: entry,
                    }))}
                />
                {this.includedEntityNames && (
                    <ul className="includedEntities">
                        {this.includedEntityNames.map((entity) => (
                            <li key={entity}>
                                <div
                                    className="clickable"
                                    onClick={() =>
                                        this.onUnincludeEntity(entity)
                                    }
                                >
                                    <FontAwesomeIcon icon={faMinus} />
                                </div>
                                {entity}
                            </li>
                        ))}
                    </ul>
                )}
                {this.includedEntityNames && (
                    <button
                        className="btn btn-light btn-clear-selection"
                        onClick={this.onClearIncludedEntities}
                    >
                        <FontAwesomeIcon icon={faTrash} /> Clear start selection
                    </button>
                )}
                <SelectField
                    label="Exclude individual entities"
                    placeholder="Select an entity to exclude"
                    value={undefined}
                    onValue={(v) => v && this.onExcludeEntity(v)}
                    options={excludedEntityChoices.map((entry) => ({
                        value: entry,
                    }))}
                />
                {this.excludedEntityNames && (
                    <ul className="excludedEntities">
                        {this.excludedEntityNames.map((entity) => (
                            <li key={entity}>
                                <div
                                    className="clickable"
                                    onClick={() =>
                                        this.onUnexcludeEntity(entity)
                                    }
                                >
                                    <FontAwesomeIcon icon={faMinus} />
                                </div>
                                {entity}
                            </li>
                        ))}
                    </ul>
                )}
                {this.excludedEntityNames && (
                    <button
                        className="btn btn-light btn-clear-selection"
                        onClick={this.onClearExcludedEntities}
                    >
                        <FontAwesomeIcon icon={faTrash} /> Clear exclude list
                    </button>
                )}
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
        const { grapher, features } = editor

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
                <Section name="Entity type">
                    <FieldsRow>
                        <BindString
                            label="Entity name (singular)"
                            field="entityType"
                            store={grapher}
                        />
                        <BindString
                            label="Entity name (plural)"
                            field="entityTypePlural"
                            store={grapher}
                        />
                    </FieldsRow>
                </Section>
                <EntitySelectionSection editor={editor} />
                {features.canHighlightSeries && (
                    <FocusSection editor={editor} />
                )}
                <EntityFilterSection editor={editor} />
                {features.canSpecifyMissingDataStrategy && (
                    <MissingDataSection editor={this.props.editor} />
                )}
            </div>
        )
    }
}
