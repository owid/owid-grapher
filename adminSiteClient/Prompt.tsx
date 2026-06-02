import * as React from "react"
import { useBlocker } from "react-router-dom"

export function Prompt({ when, message }: { when: boolean; message: string }) {
    const blocker = useBlocker(
        React.useCallback(
            ({ currentLocation, nextLocation }) => {
                return when && currentLocation.pathname !== nextLocation.pathname
            },
            [when]
        )
    )

    React.useEffect(() => {
        if (blocker.state === "blocked") {
            const proceed = window.confirm(message)
            if (proceed) {
                blocker.proceed()
            } else {
                blocker.reset()
            }
        }
    }, [blocker, message])

    return null
}
