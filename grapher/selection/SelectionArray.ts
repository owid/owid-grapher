import {
    EntityCode,
    EntityId,
    EntityName,
} from "../../coreTable/OwidTableConstants.js"
import { difference, mapBy } from "../../clientUtils/Util.js"
import { isPresent } from "../../clientUtils/isPresent.js"
import { action, computed, observable, makeObservable } from "mobx";

export interface Entity {
    entityName: EntityName
    entityId?: EntityId
    entityCode?: EntityCode
}

export class SelectionArray {
    constructor(
        selectedEntityNames: EntityName[] = [],
        availableEntities: Entity[] = [],
        entityType = "country"
    ) {
        makeObservable<SelectionArray, "availableEntities">(this, {
            entityType: observable,
            selectedEntityNames: observable,
            availableEntities: observable,
            availableEntityNames: computed,
            availableEntityNameSet: computed,
            entityNameToIdMap: computed,
            entityCodeToNameMap: computed,
            entityIdToNameMap: computed,
            hasSelection: computed,
            unselectedEntityNames: computed,
            numSelectedEntities: computed,
            selectedSet: computed,
            allSelectedEntityIds: computed,
            setSelectedEntities: action.bound,
            addToSelection: action.bound,
            addAvailableEntityNames: action.bound,
            setSelectedEntitiesByCode: action.bound,
            setSelectedEntitiesByEntityId: action.bound,
            selectAll: action.bound,
            clearSelection: action.bound,
            toggleSelection: action.bound,
            numAvailableEntityNames: computed,
            selectEntity: action.bound,
            selectSample: action.bound,
            deselectEntity: action.bound
        });

        this.selectedEntityNames = selectedEntityNames.slice()
        this.availableEntities = availableEntities.slice()
        this.entityType = entityType
    }

    entityType: string;
    selectedEntityNames: EntityName[];
    private availableEntities: Entity[];

    get availableEntityNames(): string[] {
        return this.availableEntities.map((entity) => entity.entityName)
    }

    get availableEntityNameSet(): Set<string> {
        return new Set(this.availableEntityNames)
    }

    get entityNameToIdMap(): Map<string, number | undefined> {
        return mapBy(
            this.availableEntities,
            (e) => e.entityName,
            (e) => e.entityId
        )
    }

    get entityCodeToNameMap(): Map<string | undefined, string> {
        return mapBy(
            this.availableEntities,
            (e) => e.entityCode,
            (e) => e.entityName
        )
    }

    get entityIdToNameMap(): Map<number | undefined, string> {
        return mapBy(
            this.availableEntities,
            (e) => e.entityId,
            (e) => e.entityName
        )
    }

    get hasSelection(): boolean {
        return this.selectedEntityNames.length > 0
    }

    get unselectedEntityNames(): string[] {
        return difference(this.availableEntityNames, this.selectedEntityNames)
    }

    get numSelectedEntities(): number {
        return this.selectedEntityNames.length
    }

    get selectedSet(): Set<EntityName> {
        return new Set<EntityName>(this.selectedEntityNames)
    }

    get allSelectedEntityIds(): EntityId[] {
        const map = this.entityNameToIdMap
        return this.selectedEntityNames
            .map((name) => map.get(name))
            .filter(isPresent)
    }

    // Clears and sets selected entities
    setSelectedEntities(entityNames: EntityName[]): this {
        this.clearSelection()
        return this.addToSelection(entityNames)
    }

    addToSelection(entityNames: EntityName[]): this {
        this.selectedEntityNames = this.selectedEntityNames.concat(entityNames)
        return this
    }

    addAvailableEntityNames(entities: Entity[]): this {
        this.availableEntities.push(...entities)
        return this
    }

    setSelectedEntitiesByCode(entityCodes: EntityCode[]): this {
        const map = this.entityCodeToNameMap
        const codesInData = entityCodes.filter((code) => map.has(code))
        return this.setSelectedEntities(
            codesInData.map((code) => map.get(code)!)
        )
    }

    setSelectedEntitiesByEntityId(entityIds: EntityId[]): this {
        const map = this.entityIdToNameMap
        return this.setSelectedEntities(entityIds.map((id) => map.get(id)!))
    }

    selectAll(): this {
        return this.addToSelection(this.unselectedEntityNames)
    }

    clearSelection(): void {
        this.selectedEntityNames = []
    }

    toggleSelection(entityName: EntityName): this {
        return this.selectedSet.has(entityName)
            ? this.deselectEntity(entityName)
            : this.selectEntity(entityName)
    }

    get numAvailableEntityNames(): number {
        return this.availableEntityNames.length
    }

    selectEntity(entityName: EntityName): this {
        if (!this.selectedSet.has(entityName))
            return this.addToSelection([entityName])
        return this
    }

    // Mainly for testing
    selectSample(howMany = 1): this {
        return this.setSelectedEntities(
            this.availableEntityNames.slice(0, howMany)
        )
    }

    deselectEntity(entityName: EntityName): this {
        this.selectedEntityNames = this.selectedEntityNames.filter(
            (name) => name !== entityName
        )
        return this
    }
}
