import {
    EntityCode,
    EntityId,
    EntityName,
} from "../../coreTable/OwidTableConstants.js"
import { difference, mapBy } from "../../clientUtils/Util.js"
import { isPresent } from "../../clientUtils/isPresent.js"
import { action, computed, observable } from "mobx"

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
        this.selectedEntityNames = selectedEntityNames.slice()
        this.availableEntities = availableEntities.slice()
        this.entityType = entityType
    }

    @observable entityType: string
    @observable selectedEntityNames: EntityName[]
    @observable private availableEntities: Entity[]

    @computed get availableEntityNames(): string[] {
        return this.availableEntities.map((entity) => entity.entityName)
    }

    @computed get availableEntityNameSet(): Set<string> {
        return new Set(this.availableEntityNames)
    }

    @computed get entityNameToIdMap(): Map<string, number | undefined> {
        return mapBy(
            this.availableEntities,
            (e) => e.entityName,
            (e) => e.entityId
        )
    }

    @computed get entityCodeToNameMap(): Map<string | undefined, string> {
        return mapBy(
            this.availableEntities,
            (e) => e.entityCode,
            (e) => e.entityName
        )
    }

    @computed get entityIdToNameMap(): Map<number | undefined, string> {
        return mapBy(
            this.availableEntities,
            (e) => e.entityId,
            (e) => e.entityName
        )
    }

    @computed get hasSelection(): boolean {
        return this.selectedEntityNames.length > 0
    }

    @computed get unselectedEntityNames(): string[] {
        return difference(this.availableEntityNames, this.selectedEntityNames)
    }

    @computed get numSelectedEntities(): number {
        return this.selectedEntityNames.length
    }

    @computed get selectedSet(): Set<EntityName> {
        return new Set<EntityName>(this.selectedEntityNames)
    }

    @computed get allSelectedEntityIds(): EntityId[] {
        const map = this.entityNameToIdMap
        return this.selectedEntityNames
            .map((name) => map.get(name))
            .filter(isPresent)
    }

    // Clears and sets selected entities
    @action.bound setSelectedEntities(entityNames: EntityName[]): this {
        this.clearSelection()
        return this.addToSelection(entityNames)
    }

    @action.bound addToSelection(entityNames: EntityName[]): this {
        this.selectedEntityNames = this.selectedEntityNames.concat(entityNames)
        return this
    }

    @action.bound addAvailableEntityNames(entities: Entity[]): this {
        this.availableEntities.push(...entities)
        return this
    }

    @action.bound setSelectedEntitiesByCode(entityCodes: EntityCode[]): this {
        const map = this.entityCodeToNameMap
        const codesInData = entityCodes.filter((code) => map.has(code))
        return this.setSelectedEntities(
            codesInData.map((code) => map.get(code)!)
        )
    }

    @action.bound setSelectedEntitiesByEntityId(entityIds: EntityId[]): this {
        const map = this.entityIdToNameMap
        return this.setSelectedEntities(entityIds.map((id) => map.get(id)!))
    }

    @action.bound selectAll(): this {
        return this.addToSelection(this.unselectedEntityNames)
    }

    @action.bound clearSelection(): void {
        this.selectedEntityNames = []
    }

    @action.bound toggleSelection(entityName: EntityName): this {
        return this.selectedSet.has(entityName)
            ? this.deselectEntity(entityName)
            : this.selectEntity(entityName)
    }

    @computed get numAvailableEntityNames(): number {
        return this.availableEntityNames.length
    }

    @action.bound selectEntity(entityName: EntityName): this {
        if (!this.selectedSet.has(entityName))
            return this.addToSelection([entityName])
        return this
    }

    // Mainly for testing
    @action.bound selectSample(howMany = 1): this {
        return this.setSelectedEntities(
            this.availableEntityNames.slice(0, howMany)
        )
    }

    @action.bound deselectEntity(entityName: EntityName): this {
        this.selectedEntityNames = this.selectedEntityNames.filter(
            (name) => name !== entityName
        )
        return this
    }
}
