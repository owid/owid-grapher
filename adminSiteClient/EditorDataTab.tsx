import * as _ from "lodash-es"
import * as React from "react"
import { differenceOfSets } from "@ourworldindata/utils"
import { computed, action, observable, makeObservable } from "mobx"
import { observer } from "mobx-react"
import cx from "classnames"
import {
    EntitySelectionMode,
    MissingDataStrategy,
    EntityName,
    SeriesName,
} from "@ourworldindata/types"
import { GrapherState } from "@ourworldindata/grapher"
import {
    ColorBox,
    SelectField,
    Section,
    FieldsRow,
    BindString,
} from "./Forms.js"
import {
    faLink,
    faMinus,
    faTimes,
    faTrash,
    faUnlink,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { AbstractChartEditor } from "./AbstractChartEditor.js"
import { SortableList } from "./SortableList.js"

interface EntityListItemProps extends React.HTMLProps<HTMLDivElement> {
    editor: AbstractChartEditor
    entityName: EntityName
    onRemove?: () => void
    isDndEnabled: boolean
}

interface SeriesListItemProps extends React.HTMLProps<HTMLDivElement> {
    seriesName: SeriesName
    isValid?: boolean
    onRemove?: () => void
}

@observer
class EntityListItem extends React.Component<EntityListItemProps> {
    isChoosingColor: boolean = false

    constructor(props: EntityListItemProps) {
        super(props)

        makeObservable(this, {
            isChoosingColor: observable.ref,
        })
    }

    @computed get table() {
        return this.props.editor.grapherState.table
    }

    @computed get color() {
        return this.table.getColorForEntityName(this.props.entityName)
    }

    @action.bound onColor(color: string | undefined) {
        const { grapherState } = this.props.editor
        grapherState.selectedEntityColors[this.props.entityName] = color
        grapherState.legacyConfigAsAuthored.selectedEntityColors = {
            ...grapherState.legacyConfigAsAuthored.selectedEntityColors,
            [this.props.entityName]: color,
        }
        void this.props.editor.reloadGrapherData()

        this.props.editor.grapherState.seriesColorMap?.clear()
    }

    @action.bound onRemove() {
        this.props.onRemove?.()
    }

    override render() {
        const { props, color } = this
        const { entityName, editor } = props
        const rest = _.omit(props, ["entityName", "onRemove", "editor"])

        return (
            <div
                className="list-group-item EditableListItem"
                key={entityName}
                {...rest}
            >
                <div>
                    {props.isDndEnabled && <SortableList.DragHandle />}
                    <ColorBox
                        color={color}
                        onColor={this.onColor}
                        showLineChartColors={editor.grapherState.isLineChart}
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
    constructor(props: SeriesListItemProps) {
        super(props)
        makeObservable(this)
    }

    @action.bound onRemove() {
        this.props.onRemove?.()
    }

    override render() {
        const { props } = this
        const { seriesName, isValid } = props
        const rest = _.omit(props, ["seriesName", "isValid", "onRemove"])

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
    dragKey: EntityName | undefined = undefined

    constructor(props: { editor: AbstractChartEditor }) {
        super(props)

        makeObservable(this, {
            dragKey: observable.ref,
        })
    }

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

    @action.bound onDragEnd(items: { entityName: EntityName }[]) {
        const { selection } = this.editor.grapherState

        const newSelection = items.map((item) => item.entityName)
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

    override render() {
        const { editor } = this
        const { grapherState } = editor
        const { selection } = grapherState
        const { selectedEntityNames } = selection

        const listItems = selectedEntityNames.map((entityName) => ({
            id: entityName,
            entityName,
        }))
        type SortableListItemType = (typeof listItems)[number]

        const isDndEnabled = listItems.length > 1

        const unselectedEntityNames = _.difference(
            grapherState.availableEntityNames,
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
                    {editor.canPropertyBeInherited("selectedEntityNames") && (
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
                <SortableList<SortableListItemType>
                    items={listItems}
                    onChange={this.onDragEnd}
                    isDndEnabled={isDndEnabled}
                    renderItem={(item) => (
                        <SortableList.Item id={item.id}>
                            <EntityListItem
                                editor={editor}
                                entityName={item.entityName}
                                onRemove={() =>
                                    this.onRemoveKey(item.entityName)
                                }
                                isDndEnabled={isDndEnabled}
                            />
                        </SortableList.Item>
                    )}
                />
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
    constructor(props: { editor: AbstractChartEditor }) {
        super(props)
        makeObservable(this)
    }

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

    override render() {
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

        const availableSeriesNames: SeriesName[] = _.sortBy(
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
                    {editor.canPropertyBeInherited("focusedSeriesNames") && (
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
    constructor(props: { editor: Editor }) {
        super(props)
        makeObservable(this)
    }

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

    override render() {
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
class EntityFilterSection<
    Editor extends AbstractChartEditor,
> extends React.Component<{ editor: Editor }> {
    constructor(props: { editor: Editor }) {
        super(props)
        makeObservable(this)
    }

    @computed private get editor(): Editor {
        return this.props.editor
    }

    @computed private get grapherState(): GrapherState {
        return this.editor.grapherState
    }

    @computed private get includedEntityNames(): EntityName[] {
        return this.grapherState.includedEntityNames ?? []
    }

    @computed private get excludedEntityNames(): EntityName[] {
        return this.grapherState.excludedEntityNames ?? []
    }

    @computed private get includedEntityChoices() {
        const { inputTable, includedEntityNames = [] } = this.grapherState
        return inputTable.availableEntityNames
            .filter((entityName) => !includedEntityNames.includes(entityName))
            .sort()
    }

    @computed private get excludedEntityChoices() {
        const { excludedEntityNames = [] } = this.grapherState
        const availableEntityNames =
            this.includedEntityNames.length > 0
                ? this.includedEntityNames
                : this.grapherState.availableEntityNames
        return availableEntityNames
            .filter((entityName) => !excludedEntityNames.includes(entityName))
            .sort()
    }

    @action.bound validateSelectionAndFocus() {
        this.editor.removeInvalidSelectedEntityNames()
        this.editor.removeInvalidFocusedSeriesNames()
    }

    @action.bound onExcludeEntity(entityName: string) {
        const { grapherState } = this
        if (grapherState.excludedEntityNames === undefined) {
            grapherState.excludedEntityNames = []
        }

        if (!grapherState.excludedEntityNames.includes(entityName))
            grapherState.excludedEntityNames.push(entityName)

        this.validateSelectionAndFocus()
    }

    @action.bound onUnexcludeEntity(entityName: string) {
        const { grapherState } = this
        if (!grapherState.excludedEntityNames) return
        grapherState.excludedEntityNames =
            grapherState.excludedEntityNames.filter((e) => e !== entityName)

        this.validateSelectionAndFocus()
    }

    @action.bound onIncludeEntity(entityName: string) {
        const { grapherState } = this
        if (grapherState.includedEntityNames === undefined) {
            grapherState.includedEntityNames = []
        }

        if (!grapherState.includedEntityNames.includes(entityName))
            grapherState.includedEntityNames.push(entityName)

        this.validateSelectionAndFocus()
    }

    @action.bound onUnincludeEntity(entityName: string) {
        const { grapherState } = this
        if (!grapherState.includedEntityNames) return
        grapherState.includedEntityNames =
            grapherState.includedEntityNames.filter((e) => e !== entityName)

        this.validateSelectionAndFocus()
    }

    @action.bound onClearExcludedEntities() {
        const { grapherState } = this
        grapherState.excludedEntityNames = []
        this.validateSelectionAndFocus()
    }

    @action.bound onClearIncludedEntities() {
        const { grapherState } = this
        grapherState.includedEntityNames = []
        this.validateSelectionAndFocus()
    }

    override render() {
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
    override render() {
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
                <Section name="Entity type">
                    <FieldsRow>
                        <BindString
                            label="Entity name (singular)"
                            field="entityType"
                            store={grapherState}
                        />
                        <BindString
                            label="Entity name (plural)"
                            field="entityTypePlural"
                            store={grapherState}
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
