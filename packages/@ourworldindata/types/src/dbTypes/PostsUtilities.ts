import { FormattingOptions } from "../Wordpress.js"
import { PostRowEnriched, PostRowRaw } from "./Posts.js"

export function parsePostFormattingOptions(
    formattingOptions: string
): FormattingOptions {
    return JSON.parse(formattingOptions)
}

export function parsePostAuthors(authors: string): string[] {
    const authorsJson = JSON.parse(authors)
    return authorsJson
}

export function parsePostArchieml(archieml: string): any {
    // TODO: validation would be nice here
    return JSON.parse(archieml)
}

export function parsePostRow(postRow: PostRowRaw): PostRowEnriched {
    return {
        ...postRow,
        authors: postRow.authors ? parsePostAuthors(postRow.authors) : null,
        formattingOptions: postRow.formattingOptions
            ? parsePostFormattingOptions(postRow.formattingOptions)
            : null,
        archieml: postRow.archieml ? parsePostArchieml(postRow.archieml) : null,
        archieml_update_statistics: postRow.archieml_update_statistics
            ? JSON.parse(postRow.archieml_update_statistics)
            : null,
    }
}

export function serializePostRow(postRow: PostRowEnriched): PostRowRaw {
    return {
        ...postRow,
        authors: JSON.stringify(postRow.authors),
        formattingOptions: JSON.stringify(postRow.formattingOptions),
        archieml: JSON.stringify(postRow.archieml),
        archieml_update_statistics: JSON.stringify(
            postRow.archieml_update_statistics
        ),
    }
}
