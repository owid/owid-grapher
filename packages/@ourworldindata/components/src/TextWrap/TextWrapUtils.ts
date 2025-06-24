import * as _ from "lodash-es"

export type Fragment = {
    text: string
    separator: string
}

export function splitIntoFragments(
    text: string,
    separators = [" "]
): Fragment[] {
    if (_.isEmpty(text)) return []
    const fragments: Fragment[] = []
    let currText = ""
    for (const char of text) {
        if (separators.includes(char)) {
            fragments.push({ text: currText, separator: char })
            currText = ""
        } else {
            currText += char
        }
    }
    fragments.push({ text: currText, separator: "" })
    return fragments
}

export function joinFragments(fragments: Fragment[]): string {
    return fragments
        .map(({ text, separator }) => text + separator)
        .join("")
        .trim()
}
