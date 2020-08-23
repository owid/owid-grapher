describe("Navigation", function () {
    beforeEach(() => {
        cy.visit("http://localhost:3099/forests")
    })

    it("Tests mobile navigation", function () {
        cy.viewport("iphone-6")
        cy.get('[data-track-note="mobile-hamburger-button"]').click()
        cy.get(".mobile-topics-dropdown")
            .as("topicsDropdown")
            .contains("Health")
            .click()
        cy.get("@topicsDropdown")
            .contains("Smoking") // subcategory article
            .should("be.visible")
        cy.get("@topicsDropdown")
            .contains("Urbanization") // article in another category
            .should("not.exist")
        cy.get("@topicsDropdown")
            .contains("Cancer") // top category article
            .should("be.visible")
            .click()
        cy.url().should("include", "/cancer")
    })
    it("Tests desktop navigation", function () {
        cy.contains("Articles by topic").trigger("mouseover")
        cy.get(".topics-dropdown")
            .as("topicsDropdown")
            .contains("Health")
            .trigger("mouseover")
        cy.get("@topicsDropdown")
            .contains("Smoking") // subcategory article
            .should("be.visible")
        cy.get("@topicsDropdown")
            .contains("Urbanization") // article in another category
            .should("not.exist")
        cy.get("@topicsDropdown")
            .contains("Cancer") // top category article
            .should("be.visible")
            .click()
        cy.url().should("include", "/cancer")
    })
})
