// navigator.share API: taken from https://github.com/Microsoft/TypeScript/issues/18642#issuecomment-576763015
type ShareData = {
    title?: string
    text?: string
    url?: string
    files?: ReadonlyArray<File>
}

interface Navigator {
    share?: (data?: ShareData) => Promise<void>
    canShare?: (data?: ShareData) => boolean
}
