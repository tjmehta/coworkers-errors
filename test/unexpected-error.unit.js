const Code = require('code')
const Lab = require('lab')
const lab = exports.lab = Lab.script()

const describe = lab.describe
const it = lab.it
const expect = Code.expect

const UnexpectedError = require('../unexpected-error.js')

describe('UnexpectedError', function () {
  describe('constructor', function () {
    it('should create a UnexpectedError', function (done) {
      const msg = 'boom'
      const data = { foo: 'bar' }
      const err = new UnexpectedError(msg, data)
      expect(err).to.be.an.instanceOf(UnexpectedError)
      expect(err.message).to.equal(msg)
      expect(err.data).to.deep.equal(data)
      expect(err.stack).to.exist()
      expect(err.name).to.equal('UnexpectedError')
      done()
    })

    it('should create an UnexpectedError w/ default data', function (done) {
      const err = new UnexpectedError('boom')
      expect(err.data).to.deep.equal({})
      done()
    })
  })
})
