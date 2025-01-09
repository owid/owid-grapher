import { last } from "@ourworldindata/utils"

export const formatAuthors = ({
    authors,
    forBibtex,
}: {
    authors: string[]
    forBibtex?: boolean
}) => {
    let authorsText = authors.slice(0, -1).join(forBibtex ? " and " : ", ")
    if (authorsText.length === 0) authorsText = authors[0]
    else authorsText += ` and ${last(authors)}`

    return authorsText
}
