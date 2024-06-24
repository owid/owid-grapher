import { invert, lazy, regions } from "@ourworldindata/utils"
import { EntityName } from "@ourworldindata/types"

const entityCodesToEntityNames: () => Record<string, string> = lazy(() =>
    Object.fromEntries(regions.map(({ code, name }) => [code, name]))
)

const entityNamesToEntityCodes = lazy(() => invert(entityCodesToEntityNames()))

export const codeToEntityName = (codeOrEntityName: string): EntityName => {
    return entityCodesToEntityNames()[codeOrEntityName] ?? codeOrEntityName
}

export const entityNameToCode = (entityName: EntityName): string => {
    return entityNamesToEntityCodes()[entityName] ?? entityName
}
