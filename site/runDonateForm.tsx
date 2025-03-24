import { render } from "react-dom"
import { getUserCountryInformation } from "@ourworldindata/utils"
import { DonateForm } from "./DonateForm.js"

export async function runDonateForm() {
    const localCountryInfo = await getUserCountryInformation()
    render(
        <DonateForm countryCode={localCountryInfo?.code} />,
        document.querySelector(".donate-form-container")
    )
}
