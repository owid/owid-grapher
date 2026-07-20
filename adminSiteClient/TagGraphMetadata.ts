import { MinimalTagWithMetadata, TagGraphRole } from "@ourworldindata/types"

export type { MinimalTagWithMetadata } from "@ourworldindata/types"

export function getTagGraphRolesById(
    tags: readonly MinimalTagWithMetadata[]
): ReadonlyMap<number, TagGraphRole> {
    return new Map(tags.map((tag) => [tag.id, tag.tagGraphRole]))
}

export function getTagGraphRoleById(
    rolesById: ReadonlyMap<number, TagGraphRole>,
    tagId: number
): TagGraphRole {
    const role = rolesById.get(tagId)
    if (!role) throw new Error(`Tag graph role not found for tag ${tagId}`)
    return role
}
