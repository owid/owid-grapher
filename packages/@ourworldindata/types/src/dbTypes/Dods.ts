import { PhrasingContent } from "mdast"
import { OwidEnrichedGdocBlock } from "../gdocTypes/ArchieMlComponents.js"

export const DodsTableName = "dods"

export interface DbInsertDod {
    name: string
    content: string
    lastUpdatedUserId: number
    createdAt?: Date
    updatedAt?: Date
    id?: number
}

export type DbPlainDod = Required<DbInsertDod>

/**
 * These are the OwidEnrichedGdocBlock types that are supported in the DODs.
 */
export type DodMarkdownSupportedBlock = Extract<
    OwidEnrichedGdocBlock,
    { type: "text" | "list" | "numbered-list" }
>

/**
 * These are the valid children of the mdast PhrasingContent that gets converted to DodMarkdownSupportedBlocks.
 */
export type ValidPhrasingContent = Extract<
    PhrasingContent,
    { type: "text" | "link" | "emphasis" | "strong" | "break" }
>
