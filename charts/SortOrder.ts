export enum SortOrder {
    asc = "asc",
    desc = "desc"
}

export function toggleSort(order: SortOrder): SortOrder {
    return order === SortOrder.desc ? SortOrder.asc : SortOrder.desc
}
