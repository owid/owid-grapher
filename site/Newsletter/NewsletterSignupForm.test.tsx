/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { NewsletterSignupForm } from "./NewsletterSignupForm.js"
import { NewsletterSubscriptionContext } from "../newsletter.js"

const renderForm = () =>
    render(
        <NewsletterSignupForm context={NewsletterSubscriptionContext.Latest} />
    )

describe(NewsletterSignupForm, () => {
    it("subscribes in place with the Brief alone, hands over with Follow Topics", () => {
        renderForm()
        const button = screen.getByRole("button")
        expect(button).toHaveTextContent("Subscribe")
        expect(button).not.toBeDisabled()

        fireEvent.click(screen.getByLabelText(/Follow Topics/))
        expect(button).toHaveTextContent("See subscription options")
        expect(screen.getByText(/Choose topics in next step/)).toBeTruthy()
    })

    it("needs at least one option", () => {
        renderForm()
        fireEvent.click(screen.getByLabelText(/The OWID Brief/))
        expect(screen.getByRole("button")).toBeDisabled()
        expect(screen.getByText("Please select at least one option.")).toBeTruthy()
    })
})
