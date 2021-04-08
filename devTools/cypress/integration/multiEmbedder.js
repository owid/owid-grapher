describe("MultiEmbedder", function () {
    beforeEach(() => {
        cy.visit("/multiEmbedderTest")
    })

    // Tentative tests, probably run into https://github.com/cypress-io/cypress/issues/3848
    // it("Loads all charts within 2 viewports worth", function () {
    //     cy.get("[data-test=within-bounds]").should("be.not.empty")
    // })

    // it("Lazily loads beyond 2 viewports worth", function () {
    //     cy.get("[data-test=out-of-bounds]").should("be.empty")
    //     cy.get("[data-test=heading-before-spacer]").scrollIntoView()
    //     cy.get("[data-test=out-of-bounds]").should("be.not.empty")
    // })
})
