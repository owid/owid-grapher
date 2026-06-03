import { unstable_usePrompt } from "react-router"

export function Prompt({ when, message }: { when: boolean; message: string }) {
    unstable_usePrompt({
        when,
        message,
    })

    return null
}
