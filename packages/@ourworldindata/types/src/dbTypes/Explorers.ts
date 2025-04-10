export const ExplorersTableName = "explorers"

import { JsonString } from "../domainTypes/Various.js"

export interface DbInsertExplorer {
    slug: string
    tsv: string
    lastEditedByUserId: number
    commitMessage: string
}

export type DbPlainExplorer = Required<DbInsertExplorer> & {
    isPublished: boolean
    // lastEditedAt is set when a user edits an explorer
    lastEditedAt: Date
    createdAt: Date
    // updatedAt is set automatically by MySQL
    updatedAt: Date
    // config is a parsed version of the TSV
    // it is used in getNonGrapherExplorerViewCount or in getPublishedExplorersBySlug
    config: JsonString
}

/** A sparse set of explorer metadata. Currently used to begin Algolia indexing with */
export type MinimalExplorerInfo = {
    slug: string
    title: string
    subtitle: string
    tags: string[]
}
