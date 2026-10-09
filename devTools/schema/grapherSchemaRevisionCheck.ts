import * as _ from "lodash-es"
import type { JSONSchema7 } from "json-schema"
import { formatGrapherSchemaFileName } from "@ourworldindata/utils"
import { findDeclaredSchemaRevision } from "./grapherSchemaSource.js"

export interface SchemaRevisionCheckResult {
    isPassing: boolean
    message: string
}

export function compareSchemaToPublished(
    version: string,
    schema: JSONSchema7,
    published: JSONSchema7
): SchemaRevisionCheckResult {
    const declaredRevision = findDeclaredSchemaRevision(schema)
    const publishedRevision = findDeclaredSchemaRevision(published)
    if (declaredRevision === undefined)
        return {
            isPassing: false,
            message: `This schema's $id names no revision. Name one, as in ${formatGrapherSchemaFileName(version, 0)}.`,
        }

    if (publishedRevision === undefined)
        return {
            isPassing: true,
            message: `The published ${formatGrapherSchemaFileName(version)} predates revisions, so nothing was compared`,
        }

    const declaredFileName = formatGrapherSchemaFileName(
        version,
        declaredRevision
    )
    const publishedFileName = formatGrapherSchemaFileName(
        version,
        publishedRevision
    )
    const nextFileName = formatGrapherSchemaFileName(
        version,
        publishedRevision + 1
    )

    if (_.isEqual(schema, published))
        return {
            isPassing: true,
            message: `The schema matches the published ${publishedFileName}`,
        }

    if (declaredRevision > publishedRevision)
        return {
            isPassing: true,
            message: `The schema declares ${declaredFileName}, which is unpublished`,
        }

    if (declaredRevision === publishedRevision)
        return {
            isPassing: false,
            message: `${declaredFileName} is already published, and this branch changes it. Move the revision in $id to publish as ${nextFileName}.`,
        }

    return {
        isPassing: false,
        message: `${declaredFileName} is already published, and ${publishedFileName} is newer. Update this branch, then move the revision in $id to publish as ${nextFileName}.`,
    }
}
