import { invert, regions } from "@ourworldindata/utils"
import { EntityName } from "@ourworldindata/types"

export const entityCodesToEntityNames: Record<string, string> =
    Object.fromEntries(regions.map(({ code, name }) => [code, name]))

export const entityNamesToEntityCodes = invert(entityCodesToEntityNames)

export const codeToEntityName = (codeOrEntityName: string): EntityName => {
    return entityCodesToEntityNames[codeOrEntityName] ?? codeOrEntityName
}

export const entityNameToCode = (entityName: EntityName): string => {
    return entityNamesToEntityCodes[entityName] ?? entityName
}
