import { Timeago } from "./Forms.js"

export function SvgTesterRefreshedLabel({
    isError,
    dataUpdatedAt,
}: {
    isError: boolean
    dataUpdatedAt: number
}) {
    if (isError) return <>Couldn&apos;t refresh — retrying</>
    if (!dataUpdatedAt) return null
    return (
        <>
            Refreshed <Timeago time={dataUpdatedAt} />
        </>
    )
}
