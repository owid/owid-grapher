const { exec } = require("utils/server/serverUtil")

describe("serverUtil", () => {
    describe("exec()", () => {
        it("should resolve when there is a zero exit code", () => {
            expect(exec(`echo "it works"; exit 0`)).resolves.toEqual(
                "it works\n"
            )
        })

        it("should reject when there is a non-zero exit code", () => {
            expect(exec(`echo "does not work"; exit 1`)).rejects.toBeInstanceOf(
                Error
            )
        })
    })
})
