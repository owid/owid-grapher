export const isAndroid = (): boolean => {
    return /Android/i.test(navigator.userAgent)
}

export const isIOS = (): boolean => {
    return (
        /iPhone|iPad|iPod/.test(navigator.userAgent) ||
        // iPadOS 13+ reports itself as Macintosh, see https://stackoverflow.com/a/9039885
        (navigator.userAgent.includes("Intel Mac OS X") &&
            navigator.maxTouchPoints > 1)
    )
}
