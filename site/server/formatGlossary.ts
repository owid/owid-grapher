interface GlossaryItem {
    term: string
    slug: string
}

export const getGlossary = (): GlossaryItem[] => {
    // TODO
    return [
        { term: "population", slug: "population" },
        { term: "population growth", slug: "population-growth" },
    ]
}

/*
 * Sort the glossary * in place *, in descending order of term lengths so that longer terms
 * match and are linked instead of shorter ones, which might be included in
 * them. E.g. favour "population growth" over "population"
 */
export const _sortGlossary = (glossary: GlossaryItem[]) => {
    return glossary.sort((a, b) => b.term.length - a.term.length)
}

export const formatGlossaryTerms = (
    $: CheerioStatic,
    $contents: Cheerio,
    glossary: GlossaryItem[]
) => {
    // no need to deep clone the array as objects are just removed from it,
    // not mutated.
    const mutableGlossary = _sortGlossary([...glossary])

    _replaceGlossaryTerms($, $contents, mutableGlossary)
}

const _replaceGlossaryTerms = (
    $: CheerioStatic,
    $contents: Cheerio,
    glossary: GlossaryItem[]
) => {
    $contents.each((i, el) => {
        if (el.tagName === "a") return
        if (el.type === "text") {
            $(el).replaceWith(_linkGlossaryTermsInText(el.data, glossary))
        } else {
            _replaceGlossaryTerms($, $(el).contents(), glossary)
        }
    })
}

export const _linkGlossaryTermsInText = (
    srcText: string = "",
    glossary: GlossaryItem[]
) => {
    let textWithGlossaryLinks = srcText

    const regex = new RegExp(
        `\\b(${glossary.map((item) => item.term).join("|")})\\b`,
        "ig"
    )

    const _getGlossaryLink = (match: string) => {
        const idx = glossary.findIndex(
            (item) => item.term.toLowerCase() === match.toLowerCase()
        )
        if (idx === -1) return match

        const slug = glossary[idx].slug
        // Remove element in-place so that glossary items are only matched and
        // linked once per recursive traversal (at the moment, this is set to
        // once per page section)
        glossary.splice(idx, 1)

        return `<a href="/glossary/${slug}">${match}</a>`
    }

    textWithGlossaryLinks = textWithGlossaryLinks.replace(
        regex,
        _getGlossaryLink
    )
    return textWithGlossaryLinks
}
