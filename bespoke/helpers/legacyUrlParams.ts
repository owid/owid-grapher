export type CurrentParamNameByLegacyName = ReadonlyMap<string, string>

export function renameLegacyQueryParams(
    queryString: string,
    currentNameByLegacyName: CurrentParamNameByLegacyName
): string {
    const params = new URLSearchParams(queryString)
    const renamedParams = new URLSearchParams()
    let hasChanged = false

    for (const [key, value] of params) {
        const currentName = currentNameByLegacyName.get(key)
        if (currentName === undefined) {
            renamedParams.append(key, value)
            continue
        }
        hasChanged = true
        if (!params.has(currentName)) renamedParams.append(currentName, value)
    }

    if (!hasChanged) return queryString

    const serialized = renamedParams.toString()
    return queryString.startsWith("?") && serialized
        ? `?${serialized}`
        : serialized
}

export function migrateLegacyUrlParams(
    currentNameByLegacyName: CurrentParamNameByLegacyName
): void {
    const { pathname, search, hash } = window.location
    const migratedSearch = renameLegacyQueryParams(
        search,
        currentNameByLegacyName
    )
    if (migratedSearch === search) return
    window.history.replaceState(
        window.history.state,
        "",
        `${pathname}${migratedSearch}${hash}`
    )
}
