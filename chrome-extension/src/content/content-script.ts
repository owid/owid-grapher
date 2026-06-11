// Extract Google Doc ID from URL
function getDocIdFromUrl(): string | null {
    const match = window.location.href.match(/\/document\/d\/([a-zA-Z0-9_-]+)/)
    return match ? match[1] : null
}

// Listen for messages from the sidepanel or background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "GET_DOC_ID") {
        const docId = getDocIdFromUrl()
        sendResponse({ docId })
    }
    return true
})

// Notify that content script is ready
// eslint-disable-next-line no-console
console.log("[OWID Preview] Content script loaded for:", getDocIdFromUrl())
