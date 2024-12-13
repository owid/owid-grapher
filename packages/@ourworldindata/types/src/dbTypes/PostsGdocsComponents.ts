export const PostsGdocsComponentsTableName = "posts_gdocs_components"

export interface DbInsertPostGdocComponent {
    id?: number // BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
    gdocId: string // VARCHAR(255)
    config: string // JSON
    parent: string // VARCHAR(1024)
    path: string // VARCHAR(1024)
}

export type DbRawPostGdocComponent = Required<DbInsertPostGdocComponent>

export interface DbEnrichedPostGdocComponent
    extends Omit<DbRawPostGdocComponent, "config"> {
    config: Record<string, unknown>
}

export function parsePostGdocComponentConfig(
    config: string
): Record<string, unknown> {
    return JSON.parse(config)
}

export function serializePostGdocComponentConfig(
    config: Record<string, unknown>
): string {
    return JSON.stringify(config)
}

export function parsePostsGdocsComponentRow(
    row: DbRawPostGdocComponent
): DbEnrichedPostGdocComponent {
    return {
        ...row,
        config: parsePostGdocComponentConfig(row.config),
    }
}

export function serializePostsGdocsComponentRow(
    row: DbEnrichedPostGdocComponent
): DbRawPostGdocComponent {
    return {
        ...row,
        config: serializePostGdocComponentConfig(row.config),
    }
}
