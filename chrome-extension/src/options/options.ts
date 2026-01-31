import { DEFAULT_ADMIN_BASE_URL } from "../shared/api.js"

const input = document.getElementById("admin-url") as HTMLInputElement
const saveButton = document.getElementById("save") as HTMLButtonElement
const status = document.getElementById("status") as HTMLDivElement

// Load saved value
chrome.storage.sync.get("adminBaseUrl", (result) => {
    input.value = (result.adminBaseUrl as string) || DEFAULT_ADMIN_BASE_URL
})

saveButton.addEventListener("click", () => {
    const value = input.value.trim().replace(/\/+$/, "") // strip trailing slashes
    chrome.storage.sync.set({ adminBaseUrl: value }, () => {
        status.textContent = "Saved!"
        setTimeout(() => {
            status.textContent = ""
        }, 1500)
    })
})
