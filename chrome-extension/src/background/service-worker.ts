// Enable sidepanel on Google Docs pages
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error("Error setting panel behavior:", error))

// Set up sidepanel for Google Docs pages
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
    if (!tab.url) return

    const isGoogleDoc = tab.url.match(
        /^https:\/\/docs\.google\.com\/document\/d\//
    )

    if (isGoogleDoc) {
        await chrome.sidePanel.setOptions({
            tabId,
            path: "sidepanel/sidepanel.html",
            enabled: true,
        })
    } else {
        await chrome.sidePanel.setOptions({
            tabId,
            enabled: false,
        })
    }
})

// Get cookies for the appropriate domain based on URL
async function getCookiesForUrl(url: string): Promise<string> {
    // Check if cookies API is available (requires "cookies" permission in manifest)
    if (!chrome.cookies) {
        console.error("chrome.cookies API not available. Make sure the extension has been reloaded after adding the cookies permission.")
        throw new Error("Cookies API not available. Please reload the extension in chrome://extensions")
    }

    // Determine the cookie domain based on the URL
    let cookies: chrome.cookies.Cookie[]
    if (url.includes("localhost")) {
        // For localhost, get cookies by URL since domain matching is tricky
        cookies = await chrome.cookies.getAll({ url: "http://localhost:3030" })
        console.log("Localhost cookies found:", cookies.map(c => c.name))
    } else {
        cookies = await chrome.cookies.getAll({ domain: "admin.owid.io" })
        console.log("admin.owid.io cookies found:", cookies.map(c => c.name))
    }

    const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join("; ")
    console.log("Cookie header:", cookieString ? cookieString.substring(0, 50) + "..." : "(empty)")
    return cookieString
}

// Proxy API requests from sidepanel (which can't access chrome.cookies)
async function proxyFetch(url: string): Promise<unknown> {
    const cookieHeader = await getCookiesForUrl(url)

    const response = await fetch(url, {
        credentials: "include",
        headers: {
            Accept: "application/json",
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
    })

    if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `HTTP ${response.status}`)
    }

    return response.json()
}

// Listen for messages from sidepanel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "FETCH_API") {
        proxyFetch(message.url)
            .then((data) => sendResponse({ success: true, data }))
            .catch((error) => sendResponse({ success: false, error: error.message }))
        return true // Will respond asynchronously
    }
})
