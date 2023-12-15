import { FormattingOptions } from "../owidTypes.js"
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

export function parsePostRow(postRow: PostRowRaw): PostRowEnriched {
    return {
        ...postRow,
        authors: parsePostAuthors(postRow.authors),
        formattingOptions: parsePostFormattingOptions(
            postRow.formattingOptions
        ),
    }
}

export function serializePostRow(postRow: PostRowEnriched): PostRowRaw {
    return {
        ...postRow,
        authors: JSON.stringify(postRow.authors),
        formattingOptions: JSON.stringify(postRow.formattingOptions),
    }
}
