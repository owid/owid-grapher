import moment from "moment"

describe("Cookie preferences", function () {
    const DATE_FORMAT = "YYYYMMDD"
    const COOKIE_NAME = "cookie_preferences"
    const COOKIE_NOTICE = "@cookieNotice"
    const today = moment().format(DATE_FORMAT)

    beforeEach(() => {
        cy.visit("http://localhost:3030/privacy-policy")
        cy.get("[data-test=cookie-notice]").as(COOKIE_NOTICE.substr(1))
    })

    it("Accepts default cookie preferences from cookie notice bar", function () {
        cy.get(COOKIE_NOTICE)
            .should("be.visible")
            .get("[data-test=accept]")
            .click()
            .should("not.be.visible")
        cy.getCookie(COOKIE_NAME).should(
            "have.property",
            "value",
            `p:1-${today}`
        )
    })
    it("Sets cookie preferences from privacy policy page", function () {
        cy.get(COOKIE_NOTICE).should("be.visible")
        cy.get("[data-test=performance-preference]")
            .as("performanceCheckbox")
            .should("be.checked")
            .click()
        cy.get(COOKIE_NOTICE).should("not.be.visible")
        cy.get("@performanceCheckbox").should("be.not.checked")

        cy.getCookie(COOKIE_NAME).should(
            "have.property",
            "value",
            `p:0-${today}`
        )
        cy.get("@performanceCheckbox").click().should("be.checked")

        cy.getCookie(COOKIE_NAME).should(
            "have.property",
            "value",
            `p:1-${today}`
        )

        cy.reload()
        cy.get(COOKIE_NOTICE).should("not.be.visible")
    })

    it.only("Ignores malformed cookie", () => {
        cy.setCookie(COOKIE_NAME, `abcd`)
        cy.reload()
        cy.get(COOKIE_NOTICE).should("be.visible")
    })

    it("Shows / hides the cookie banner in relation to a policy update", () => {
        cy.get("[data-test-policy-date]").then((el) => {
            const policyDate = el.attr("data-test-policy-date")
            const dayBeforePolicyUpdate = moment(policyDate)
                .subtract(1, "days")
                .format(DATE_FORMAT)
            const dayAfterPolicyUpdate = moment(policyDate)
                .add(1, "days")
                .format(DATE_FORMAT)

            // Control: pretend the preferences are set the day the policy gets updated
            cy.clearCookies()
            cy.setCookie(COOKIE_NAME, `p:0-${policyDate}`)
            cy.reload()
            cy.wait(500) // Hack: wait for the potential animation to finish before asserting
            cy.get(COOKIE_NOTICE).should("not.be.visible")

            // Control: pretend the preferences are set the day after the policy
            // gets updated
            cy.clearCookies()
            cy.setCookie(COOKIE_NAME, `p:0-${dayAfterPolicyUpdate}`)
            cy.reload()
            cy.wait(500) // Hack: wait for the potential animation to finish before asserting
            cy.get(COOKIE_NOTICE).should("not.be.visible")

            // Pretend the preferences are set the day before the policy
            // gets updated
            cy.clearCookies()
            cy.setCookie(COOKIE_NAME, `p:0-${dayBeforePolicyUpdate}`)
            cy.reload()
            // no need to wait here, Cypress does it automatically before timing
            // out
            cy.get(COOKIE_NOTICE).should("be.visible")
        })
    })
})
