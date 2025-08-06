import cx from "classnames"

export function SearchHorizontalDivider({
    className = "",
}: {
    className?: string
}) {
    return <hr className={cx("search-horizontal-divider", className)} />
}
