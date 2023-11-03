const URL_REGEX =
    /[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?/gi

export const findUrlsInText = (str: string): string[] =>
    str.match(URL_REGEX) || []

const snakeToCamel = (str: string): string =>
    str.replace(/(\_\w)/g, (char) => char[1].toUpperCase())

export const camelCaseProperties = (
    obj: Record<string, unknown>
): Record<string, unknown> => {
    const newObj: any = {}
    for (const key in obj) {
        newObj[snakeToCamel(key)] = obj[key]
    }
    return newObj
}

export const includesCaseInsensitive = (
    str?: string,
    fragment?: string
): boolean =>
    !!str &&
    !!fragment &&
    str.toLocaleLowerCase().includes(fragment.toLocaleLowerCase())

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
