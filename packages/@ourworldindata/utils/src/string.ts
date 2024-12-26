const snakeToCamel = (str: string): string =>
    str.replace(/(_\w)/g, (char) => char[1].toUpperCase())

export const camelCaseProperties = (
    obj: Record<string, unknown>
): Record<string, unknown> => {
    const newObj: any = {}
    for (const key in obj) {
        newObj[snakeToCamel(key)] = obj[key]
    }
    return newObj
}

/**
 * Converts a string to title case, with support for hyphenated words
 * e.g. 'WELCOME to jean-édouard' -> 'Welcome To Jean-Édouard!'
 */
export const titleCase = (str: string): string => {
    return str
        .split(" ")
        .map(function (word) {
            return word
                .split("-")
                .map(function (subWord) {
                    return (
                        subWord.charAt(0).toUpperCase() +
                        subWord.substring(1).toLowerCase()
                    )
                })
                .join("-")
        })
        .join(" ")
}

export function toAsciiQuotes(str: string): string {
    return str.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
}

// https://stackoverflow.com/a/37511463/9846837
export function removeDiacritics(str: string): string {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}
