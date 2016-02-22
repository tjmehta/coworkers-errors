const Code = require('code')
const Lab = require('lab')
const lab = exports.lab = Lab.script()

const describe = lab.describe
const it = lab.it
const expect = Code.expect

const AppError = require('../app-error.js')
const RetryableError = require('../retryable-error.js')

describe('RetryableError', function () {
  describe('constructor', function () {
    it('should create a RetryableError', function (done) {
      const msg = 'boom'
      const data = { foo: 'bar' }
      const err = new RetryableError(msg, data)
      expect(err).to.be.an.instanceOf(RetryableError)
      expect(err).to.be.an.instanceOf(AppError)
      expect(err.message).to.equal(msg)
      expect(err.data).to.deep.equal(data)
      expect(err.stack).to.exist()
      expect(err.name).to.equal('RetryableError')
      done()
    })
  })
})
