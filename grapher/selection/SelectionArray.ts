import {
    EntityCode,
    EntityId,
    EntityName,
    OwidTableSlugs,
} from "coreTable/OwidTableConstants"
import { EntityUrlBuilder } from "grapher/core/EntityUrlBuilder"
import { difference, isPresent, mapBy } from "grapher/utils/Util"
import { action, computed, observable } from "mobx"

interface Entity {
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

    @computed get availableEntityNames() {
        return this.availableEntities.map((entity) => entity.entityName)
    }

    @computed get availableEntityNameSet() {
        return new Set(this.availableEntityNames)
    }

    private mapBy(col: keyof Entity, val: keyof Entity) {
        return mapBy(this.availableEntities, col, val)
    }

    @computed get entityNameToIdMap() {
        return this.mapBy(OwidTableSlugs.entityName, OwidTableSlugs.entityId)
    }

    @computed get entityCodeToNameMap() {
        return this.mapBy(OwidTableSlugs.entityCode, OwidTableSlugs.entityName)
    }

    @computed get entityIdToNameMap() {
        return this.mapBy(OwidTableSlugs.entityId, OwidTableSlugs.entityName)
    }

    @computed get hasSelection() {
        return this.selectedEntityNames.length > 0
    }

    @computed get unselectedEntityNames() {
        return difference(this.availableEntityNames, this.selectedEntityNames)
    }

    @computed get numSelectedEntities() {
        return this.selectedEntityNames.length
    }

    @computed get selectedSet() {
        return new Set<EntityName>(this.selectedEntityNames)
    }

    @computed get allSelectedEntityIds(): EntityId[] {
        const map = this.entityNameToIdMap
        return this.selectedEntityNames
            .map((name) => map.get(name))
            .filter(isPresent)
    }

    // Clears and sets selected entities
    @action.bound setSelectedEntities(entityNames: EntityName[]) {
        this.clearSelection()
        return this.addToSelection(entityNames)
    }

    @action.bound addToSelection(entityNames: EntityName[]) {
        this.selectedEntityNames = this.selectedEntityNames.concat(entityNames)
        return this
    }

    @action.bound addAvailableEntityNames(entities: Entity[]) {
        this.availableEntities.push(...entities)
        return this
    }

    @action.bound setSelectedEntitiesByCode(entityCodes: EntityCode[]) {
        const map = this.entityCodeToNameMap
        const codesInData = entityCodes.filter((code) => map.has(code))
        return this.setSelectedEntities(
            codesInData.map((code) => map.get(code)!)
        )
    }

    @action.bound setSelectedEntitiesByEntityId(entityIds: EntityId[]) {
        const map = this.entityIdToNameMap
        return this.setSelectedEntities(entityIds.map((id) => map.get(id)!))
    }

    @action.bound selectAll() {
        return this.addToSelection(this.unselectedEntityNames)
    }

    @action.bound clearSelection() {
        this.selectedEntityNames = []
    }

    @action.bound toggleSelection(entityName: EntityName) {
        return this.selectedSet.has(entityName)
            ? this.deselectEntity(entityName)
            : this.selectEntity(entityName)
    }

    @computed get numAvailableEntityNames() {
        return this.availableEntityNames.length
    }

    @action.bound selectEntity(entityName: EntityName) {
        return this.addToSelection([entityName])
    }

    // Mainly for testing
    @action.bound selectSample(howMany = 1) {
        return this.setSelectedEntities(
            this.availableEntityNames.slice(0, howMany)
        )
    }

    @action.bound deselectEntity(entityName: EntityName) {
        this.selectedEntityNames = this.selectedEntityNames.filter(
            (name) => name !== entityName
        )
        return this
    }

    @computed get asParam() {
        return EntityUrlBuilder.entityNamesToQueryParam(
            this.selectedEntityNames
        )
    }
}
