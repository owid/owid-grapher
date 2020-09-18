import { EntityName } from "owidTable/OwidTableConstants"
import { MapTopology } from "./MapTopology"

let _cache: Set<string>
export const isOnTheMap = (entityName: EntityName) => {
    // Cache the result
    if (!_cache)
        _cache = new Set(
            MapTopology.objects.world.geometries.map((region: any) => region.id)
        )
    return _cache.has(entityName)
}
