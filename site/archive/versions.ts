import { useMemo } from "react"
import * as R from "remeda"
import { useVersionsQuery } from "./queries.js"

export function useArchiveVersions(versionsFileUrl?: string) {
    const { data } = useVersionsQuery(versionsFileUrl)

    const versions = useMemo(() => {
        const versionsObj = data
        if (
            !R.isPlainObject(versionsObj) ||
            !("versions" in versionsObj) ||
            !Array.isArray(versionsObj.versions)
        )
            return []

        return R.sortBy(versionsObj.versions, [
            (item) => item.archivalDate,
            "desc",
        ])
    }, [data])

    return versions
}
