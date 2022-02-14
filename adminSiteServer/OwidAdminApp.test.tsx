import { OwidAdminApp } from "./OwidAdminApp.js"

jest.setTimeout(10000) // wait for up to 10s for the app server to start

describe(OwidAdminApp, () => {
    const app = new OwidAdminApp({ isDev: true, gitCmsDir: "", quiet: true })

    it("should be able to create an app", () => {
        expect(app).toBeTruthy()
    })

    it("should be able to start the app", async () => {
        await app.startListening(8765, "localhost")
        expect(app.server).toBeTruthy()
        app.stopListening()
    })
})
