import { DbInsertContentGraphLink } from "../domainTypes/ContentGraph.js"

export const PostsGdocsLinksTableName = "posts_gdocs_links"
export type DbInsertPostGdocLink = DbInsertContentGraphLink
export type DbPlainPostGdocLink = Required<DbInsertPostGdocLink>
