// TODO - proper integration testing setup
// Db management is the tricky part

const request = require('supertest')
const app = require('../dist/src/admin/app').default

describe('Admin API', () => {
    it('should return charts', async () => {
        const response = await request(app).get('/api/charts.json')
        console.log(response)
        expect(response.statusCode).toBe(200)
    })
})
