const { exec, tryExec } = require('friends/server/serverUtil')

describe('serverUtil', () => {

    describe('exec()', () => {
        it('should resolve when there is a zero exit code', () => {
            expect(exec(`echo "it works"; exit 0`)).resolves.toEqual("it works\n")
        })

        it('should reject when there is a non-zero exit code', () => {
            expect(exec(`echo "does not work"; exit 1`)).rejects.toEqual(1)
        })
    })

    describe('tryExec()', () => {
        it('should resolve when there is a zero exit code', () => {
            expect(tryExec(`echo "it works"; exit 0`)).resolves.toEqual("it works\n")
        })

        it('should resolve and return error when there is a non-zero exit code', () => {
            expect(tryExec(`echo "does not work"; exit 1`)).resolves.toEqual(1)
        })
    })

})
