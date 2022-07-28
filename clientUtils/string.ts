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
