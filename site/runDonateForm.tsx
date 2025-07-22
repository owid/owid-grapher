import { createRoot } from "react-dom/client"
import { getUserCountryInformation } from "@ourworldindata/utils"
import { DonateForm } from "./DonateForm.js"

export async function runDonateForm() {
    const localCountryInfo = await getUserCountryInformation()
    const container = document.querySelector(".donate-form-container")
    if (!container) return

    const root = createRoot(container)
    root.render(<DonateForm countryCode={localCountryInfo?.code} />)
}
