// Sorting shared by the admin's lists of charts and of multi-dims

/** Counts are most useful largest first */
export const DESCEND_FIRST: ("descend" | "ascend")[] = ["descend", "ascend"]

export function compareTimes(
    a: string | undefined,
    b: string | undefined
): number {
    return new Date(a ?? 0).getTime() - new Date(b ?? 0).getTime()
}
