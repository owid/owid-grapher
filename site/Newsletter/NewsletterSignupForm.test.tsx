/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { NewsletterSignupForm } from "./NewsletterSignupForm.js"
import { NewsletterSubscriptionContext } from "../newsletter.js"

import { TurnstileInstance, TurnstileProps } from "@marsidev/react-turnstile"

const captcha = vi.hoisted(() => ({
    props: {} as TurnstileProps,
    reset: vi.fn(),
}))
vi.mock(import("@marsidev/react-turnstile"), async () => {
    const { forwardRef, useImperativeHandle } = await import("react")
    return {
        Turnstile: forwardRef<TurnstileInstance | undefined, TurnstileProps>(
            (props, ref) => {
                captcha.props = props
                useImperativeHandle(ref, () => ({
                    reset: captcha.reset,
                    render: vi.fn(),
                    execute: vi.fn(),
                    remove: vi.fn(),
                    getResponse: vi.fn(),
                    getResponsePromise: vi.fn(),
                    isExpired: () => false,
                }))
                return null
            }
        ),
    }
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
})

const renderForm = () =>
    render(
        <NewsletterSignupForm context={NewsletterSubscriptionContext.Latest} />
    )

describe(NewsletterSignupForm, () => {
    it("subscribes in place with the Brief alone, hands over with Follow Topics", () => {
        renderForm()
        const button = screen.getByRole("button")
        expect(button).toHaveTextContent("Subscribe")
        expect(button).toBeDisabled()

        fireEvent.click(screen.getByLabelText(/Follow Topics/))
        expect(button).toHaveTextContent("See subscription options")
        expect(button).not.toBeDisabled()
        expect(screen.getByText(/Choose topics in next step/)).toBeTruthy()
    })

    it("waits for verification, sends the token and honeypot, and refreshes after failure", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ error: "Try again" }), {
                status: 400,
            })
        )
        vi.stubGlobal("fetch", fetchMock)
        const { container } = renderForm()
        const button = screen.getByRole("button")
        fireEvent.change(screen.getByPlaceholderText("Your email address"), {
            target: { value: "reader@example.com" },
        })
        fireEvent.submit(container.querySelector("form")!)
        expect(fetchMock).not.toHaveBeenCalled()
        act(() => captcha.props.onSuccess?.("captcha-token"))
        expect(button).not.toBeDisabled()
        fireEvent.submit(container.querySelector("form")!)
        await waitFor(() => expect(screen.getByText("Try again")).toBeTruthy())
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
            captchaToken: "captcha-token",
            website: "",
        })
        expect(captcha.reset).toHaveBeenCalled()
        expect(button).toBeDisabled()
        act(() => captcha.props.onSuccess?.("fresh-token"))
        expect(button).not.toBeDisabled()
        act(() => captcha.props.onExpire?.("expired-token"))
        expect(button).toBeDisabled()
    })

    it("does not start another challenge after a successful subscription", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(Response.json({ ok: true }))
        )
        const { container } = renderForm()
        fireEvent.change(screen.getByPlaceholderText("Your email address"), {
            target: { value: "reader@example.com" },
        })
        act(() => captcha.props.onSuccess?.("captcha-token"))
        fireEvent.submit(container.querySelector("form")!)
        await screen.findByText(
            "Your subscription to The OWID Brief is active."
        )
        expect(captcha.reset).not.toHaveBeenCalled()
    })

    it("needs at least one option", () => {
        renderForm()
        fireEvent.click(screen.getByLabelText(/The OWID Brief/))
        expect(screen.getByRole("button")).toBeDisabled()
        expect(
            screen.getByText("Please select at least one option.")
        ).toBeTruthy()
    })
})
