export function camelToSnake(s: string) {
    return s
        .split(/(?<=[a-z])(?=[A-Z])/g)
        .join("_")
        .toLowerCase()
}

export function snakeToCamel(s: string) {
    return s.replace(/(\_\w)/g, (m) => m[1].toUpperCase())
}

export function camelCaseProperties<T>(obj: T): T {
    const o: any = {}
    for (const key in obj as any) {
        o[snakeToCamel(key)] = (obj as any)[key]
    }
    return o
}
