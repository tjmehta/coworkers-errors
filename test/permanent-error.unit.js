const Code = require('code')
const Lab = require('lab')
const lab = exports.lab = Lab.script()

const describe = lab.describe
const it = lab.it
const expect = Code.expect

const AppError = require('../app-error.js')
const PermanentError = require('../permanent-error.js')

describe('PermanentError', function () {
  describe('constructor', function () {
    it('should create a PermanentError', function (done) {
      const msg = 'boom'
      const data = { foo: 'bar' }
      const err = new PermanentError(msg, data)
      expect(err).to.be.an.instanceOf(PermanentError)
      expect(err).to.be.an.instanceOf(AppError)
      expect(err.message).to.equal(msg)
      expect(err.data).to.deep.equal(data)
      expect(err.stack).to.exist()
      expect(err.name).to.equal('PermanentError')
      done()
    })
  })
})
