import { Badge, Button } from "antd"

export const GdocsDiffButton = ({
    hasChanges,
    setDiffOpen,
}: {
    hasChanges: boolean
    setDiffOpen: (status: boolean) => void
}) => {
    return (
        <Badge dot={hasChanges}>
            <Button disabled={!hasChanges} onClick={() => setDiffOpen(true)}>
                View changes
            </Button>
        </Badge>
    )
}
