import { QueryStatus } from "@tanstack/react-query"

/** Fold the statuses of several queries into one: error wins, then pending */
export function combineStatuses(...statuses: QueryStatus[]): QueryStatus {
    if (statuses.some((status) => status === "error")) return "error"
    if (statuses.some((status) => status === "pending")) return "pending"
    return "success"
}
