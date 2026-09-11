/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { EmailNotificationsPreferencesForm } from "./EmailNotificationsPreferencesForm.js"

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
    render(<EmailNotificationsPreferencesForm topicAreaNames={[]} />)

describe("request a preferences link", () => {
    it("waits for verification, sends its token, and refreshes only after failure", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                Response.json({ error: "Try again" }, { status: 400 })
            )
            .mockResolvedValueOnce(Response.json({ ok: true }))
        vi.stubGlobal("fetch", fetchMock)
        const { container } = renderForm()
        const button = screen.getByRole("button", { name: "Email me a link" })
        const form = container.querySelector("form")!
        expect(button).toBeDisabled()
        expect(captcha.props.options?.action).toBe("request-link")
        fireEvent.change(screen.getByPlaceholderText("Your email address"), {
            target: { value: "reader@example.com" },
        })
        fireEvent.submit(form)
        expect(fetchMock).not.toHaveBeenCalled()
        act(() => captcha.props.onSuccess?.("captcha-token"))
        expect(button).not.toBeDisabled()
        act(() => captcha.props.onExpire?.("captcha-token"))
        expect(button).toBeDisabled()
        act(() => captcha.props.onSuccess?.("fresh-token"))
        fireEvent.submit(form)
        await screen.findByText("Try again")
        await waitFor(() => expect(captcha.reset).toHaveBeenCalledOnce())
        expect(button).toBeDisabled()
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
            email: "reader@example.com",
            captchaToken: "fresh-token",
            website: "",
        })
        act(() => captcha.props.onSuccess?.("retry-token"))
        fireEvent.submit(form)
        await screen.findByText("Check your inbox")
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(captcha.reset).toHaveBeenCalledOnce()
    })
})
