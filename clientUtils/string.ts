const URL_REGEX = /[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?/gi

export const findUrlsInText = (str: string): string[] =>
    str.match(URL_REGEX) || []

export const parseBool = (input: string) => {
    const normalized = input.trim().toLowerCase()
    return normalized === "true" || normalized === "1"
}

const snakeToCamel = (str: string) =>
    str.replace(/(\_\w)/g, (char) => char[1].toUpperCase())

export const camelCaseProperties = (obj: any) => {
    const newObj: any = {}
    for (const key in obj) {
        newObj[snakeToCamel(key)] = obj[key]
    }
    return newObj
}
