const { exec, tryExec } = require('../../util/server/serverUtil')

describe('serverUtil', () => {

    describe('exec()', () => {
        it('should resolve when there is a zero exit code', () => {
            expect(exec(`echo "it works"; exit 0`)).resolves.toEqual({
                stdout: 'it works\n',
                stderr: ''
            })
        })

        it('should reject when there is a non-zero exit code', () => {
            expect(exec(`echo "does not work"; exit 1`)).rejects.toMatchObject({
                stdout: 'does not work\n'
            })
        })
    })

    describe('tryExec()', () => {
        it('should resolve when there is a zero exit code', () => {
            expect(tryExec(`echo "it works"; exit 0`)).resolves.toEqual({
                stdout: 'it works\n',
                stderr: ''
            })
        })

        it('should resolve and inject error when there is a non-zero exit code', () => {
            const command = tryExec(`echo "does not work"; exit 1`)
            expect(command).resolves.toMatchObject({
                stdout: 'does not work\n',
                stderr: ''
            })
            expect(command).resolves.toHaveProperty('error')
        })
    })

})
