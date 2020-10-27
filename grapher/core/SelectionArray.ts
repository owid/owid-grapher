import {
    EntityCode,
    EntityId,
    EntityName,
    OwidTableSlugs,
} from "coreTable/OwidTableConstants"
import { difference, isPresent, mapBy } from "grapher/utils/Util"
import { action, computed } from "mobx"

interface Entity {
    entityName: EntityName
    entityId?: EntityId
    entityCode?: EntityCode
}

export interface SelectionManager {
    selectedEntityNames: EntityName[]
    availableEntities: Entity[]
}

export class SelectionArray {
    constructor(manager: SelectionManager) {
        this.manager = manager
    }

    private manager: SelectionManager

    @computed get selectedEntityNames() {
        return this.manager.selectedEntityNames
    }

    @computed private get availableEntities() {
        return this.manager.availableEntities
    }

    @computed get availableEntityNames() {
        return this.availableEntities.map((entity) => entity.entityName)
    }

    private mapBy(col: string, val: string) {
        return mapBy(this.availableEntities, col, val)
    }

    @computed get entityNameToCodeMap() {
        return this.mapBy(OwidTableSlugs.entityName, OwidTableSlugs.entityCode)
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

    @computed private get selectedEntityNameSet() {
        return new Set<EntityName>(this.selectedEntityNames)
    }

    @computed get selectedEntityCodes(): EntityCode[] {
        const map = this.entityNameToCodeMap
        return this.selectedEntityNames
            .map((name) => map.get(name))
            .filter(isPresent)
    }

    @computed get selectedEntityCodesOrNames(): (EntityCode | EntityName)[] {
        const map = this.entityNameToCodeMap
        return this.selectedEntityNames.map((name) => map.get(name) ?? name)
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
        this.manager.selectedEntityNames = this.selectedEntityNames.concat(
            entityNames
        )
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
        this.manager.selectedEntityNames = []
    }

    @action.bound toggleSelection(entityName: EntityName) {
        return this.isEntitySelected(entityName)
            ? this.deselectEntity(entityName)
            : this.selectEntity(entityName)
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
        this.manager.selectedEntityNames = this.selectedEntityNames.filter(
            (name) => name !== entityName
        )
        return this
    }

    isEntitySelected(entityName: EntityName) {
        return this.selectedEntityNameSet.has(entityName)
    }
}
