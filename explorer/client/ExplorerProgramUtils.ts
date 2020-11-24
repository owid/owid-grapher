import { parseDelimited } from "coreTable/CoreTableUtils"

export const getRequiredGrapherIds = (code: string) =>
    parseDelimited(code)
        .map((row: any) => parseInt(row.grapherId!))
        .filter((id) => !isNaN(id))
