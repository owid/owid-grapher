export const ExplorersTableName = "explorers"

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
    // these properties are populated from Buildkite's pipeline "Mirror explorers to MySQL"
    config: string
}

export type DbPlainExplorerWithLastCommit = Required<DbPlainExplorer> & {
    // lastCommit is a relic from our git-CMS days, it should be broken down
    // to individual fields in the future
    lastCommit: string
}

/** A sparse set of explorer metadata. Currently used to begin Algolia indexing with */
export type MinimalExplorerInfo = {
    slug: string
    title: string
    subtitle: string
    tags: string[]
}
