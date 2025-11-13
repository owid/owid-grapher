import { useMemo } from "react"
import * as R from "remeda"
import { useVersionsQuery, UseVersionsQueryOptions } from "./queries.js"

export function useArchiveVersions(
    versionsFileUrl?: string,
    options?: UseVersionsQueryOptions
) {
    const result = useVersionsQuery(versionsFileUrl, options)

    const versions = useMemo(() => {
        const versionsObj = result.data
        if (
            !R.isPlainObject(versionsObj) ||
            !("versions" in versionsObj) ||
            !Array.isArray(versionsObj.versions)
        )
            return []

        return versionsObj.versions
    }, [result.data])

    return useMemo(
        () => ({
            ...result,
            data: versions,
        }),
        [result, versions]
    )
}
