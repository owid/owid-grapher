const grecaptcha = (window as any).grecaptcha
import { RECAPTCHA_SITE_KEY } from 'settings'

export async function getCaptchaToken(action: string): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!grecaptcha) return reject(new Error("Couldn't load reCAPTCHA. Please check that it isn't blocked by your ad-blocker. Email us at info@ourworldindata.org if you cannot resolve the problem."))
        grecaptcha.ready(() => {
            grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: action }).then(resolve, reject)
        })
    })
}
