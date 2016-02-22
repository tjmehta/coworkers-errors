'use strict'

const Code = require('code')
const errToJSON = require('utils-error-to-json')
const Lab = require('lab')
const proxyquire = require('proxyquire')
const sinon = require('sinon')

const lab = exports.lab = Lab.script()
const describe = lab.describe
const it = lab.it
const beforeEach = lab.beforeEach
const expect = Code.expect

const AppError = require('../app-error.js')
const FatalError = require('../fatal-error.js')

describe('FatalError', function () {
  let ctx
  beforeEach(function (done) {
    ctx = {}
    done()
  })
  describe('constructor', function () {
    it('should create a FatalError', function (done) {
      const msg = 'boom'
      const data = { foo: 'bar' }
      const err = new FatalError(msg, data)
      expect(err).to.be.an.instanceOf(FatalError)
      expect(err).to.be.an.instanceOf(AppError)
      expect(err.message).to.equal(msg)
      expect(err.data).to.deep.equal(data)
      expect(err.stack).to.exist()
      expect(err.name).to.equal('FatalError')
      done()
    })
  })

  describe('throwNextTick', function () {
    beforeEach(function (done) {
      ctx.throwNextTick = sinon.stub()
      ctx.FatalError = proxyquire('../fatal-error.js', {
        'throw-next-tick': ctx.throwNextTick
      })
      done()
    })

    it('should wrap and throwNextTick the fatal error', function (done) {
      const origErr = new Error('baboom')
      ctx.FatalError.throwNextTick(origErr)
      sinon.assert.calledOnce(ctx.throwNextTick)
      const err = ctx.throwNextTick.args[0][0]
      expect(err).to.be.an.instanceOf(AppError)
      expect(err.message).to.equal(origErr.message)
      expect(err.name).to.equal('FatalError')
      expect(err.stack).to.not.equal(origErr.stack)
      expect(err.stack).to.contain(origErr.stack.split('\n').slice(1).join('\n'))
      expect(err.stack).to.not.contain('app-error.js')
      expect(err.stack).to.not.contain('throwNextTick')
      expect(err.stack).to.not.contain('wrap')
      expect(err.data).to.deep.equal({ err: errToJSON(origErr) })
      done()
    })
  })
})
