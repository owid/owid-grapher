import { lazy, regions } from "@ourworldindata/utils"
import { EntityName } from "@ourworldindata/types"
import * as R from "remeda"

const getEntityCodesToEntityNames: () => Record<string, string> = lazy(() =>
    Object.fromEntries(regions.map(({ code, name }) => [code, name]))
)

const getEntityNamesToEntityCodes = lazy(() =>
    R.invert(getEntityCodesToEntityNames())
)

export const codeToEntityName = (codeOrEntityName: string): EntityName => {
    return getEntityCodesToEntityNames()[codeOrEntityName] ?? codeOrEntityName
}

export const entityNameToCode = (entityName: EntityName): string => {
    return getEntityNamesToEntityCodes()[entityName] ?? entityName
}
