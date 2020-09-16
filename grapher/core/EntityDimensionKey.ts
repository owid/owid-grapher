// todo: remove this concept. Have selected rows (or selected cells, etc) instead.
import { EntityName } from "owidTable/OwidTableConstants"
import { EntityDimensionKey } from "./GrapherConstants"

// Make a unique string key for an entity on a variable
export const makeEntityDimensionKey = (
    entityName: EntityName,
    dimensionIndex: number
): EntityDimensionKey => `${entityName}_${dimensionIndex}`
