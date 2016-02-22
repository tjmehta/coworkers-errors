'use strict'

const Code = require('code')
const errToJSON = require('utils-error-to-json')
const Lab = require('lab')
const proxyquire = require('proxyquire')
const sinon = require('sinon')

const lab = exports.lab = Lab.script()
const describe = lab.describe
const beforeEach = lab.beforeEach
const afterEach = lab.afterEach
const it = lab.it
const expect = Code.expect

describe('AppError', function () {
  let ctx
  beforeEach(function (done) {
    ctx = {}
    ctx.id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
    ctx.time = Date.now()
    ctx.stack = 'stack'
    sinon.stub(Error, 'captureStackTrace', function (err) {
      err.stack = ctx.stack
    })
    ctx.uuid = sinon.stub().returns(ctx.id)
    ctx.dateNow = sinon.stub().returns(ctx.time)
    ctx.AppError = proxyquire('../app-error.js', {
      uuid: ctx.uuid,
      './lib/date-now.js': ctx.dateNow
    })
    done()
  })
  afterEach(function (done) {
    if (Error.captureStackTrace.restore) {
      Error.captureStackTrace.restore()
    }
    done()
  })

  describe('constructor', function () {
    it('should create a AppError', function (done) {
      const AppError = ctx.AppError
      const msg = 'boom'
      const data = { foo: 'bar', qux: { toJSON: sinon.stub().returns({}) }, yolo: null, arr: [1] }
      const err = new AppError(msg, data)
      sinon.assert.calledOnce(ctx.dateNow)
      sinon.assert.calledOnce(Error.captureStackTrace)
      sinon.assert.calledWith(Error.captureStackTrace, err, err.constructor)
      sinon.assert.calledOnce(ctx.uuid)
      expect(err).to.be.an.instanceOf(AppError)
      expect(err).to.be.an.instanceOf(Error)
      expect(err.message).to.equal(msg)
      expect(err.data).to.deep.equal({
        foo: 'bar',
        qux: {},
        yolo: null,
        arr: [1]
      })
      expect(err.id).to.equal(ctx.id)
      expect(err.time).to.equal(ctx.time)
      expect(err.stack).to.equal(ctx.stack)
      expect(err.name).to.equal('AppError')
      done()
    })

    it('should create an AppError w/ default data', function (done) {
      const AppError = ctx.AppError
      const err = new AppError('boom')
      expect(err.data).to.deep.equal({})
      done()
    })

    it('should use same err id if one exists', function (done) {
      const AppError = ctx.AppError
      const err = new AppError('boom')
      const err2 = AppError.wrap(err)
      expect(err.id).to.equal(err2.id)
      done()
    })
  })

  describe('throw and wrap', function () {
    beforeEach(function (done) {
      // Use real stack
      Error.captureStackTrace.restore()
      done()
    })

    it('should wrap and throw the error', function (done) {
      const AppError = ctx.AppError
      const origErr = new Error('boom')
      const data = { foo: 'bar' }
      try {
        AppError.throw(origErr, data)
        done(new Error('expected a throw error'))
      } catch (err) {
        expect(err).to.be.an.instanceOf(AppError)
        expect(err.message).to.equal(origErr.message)
        expect(err.name).to.equal('AppError')
        expect(err.stack).to.not.equal(origErr.stack)
        expect(err.stack).to.contain(origErr.stack.split('\n').slice(1).join('\n'))
        expect(err.stack).to.not.contain('app-error.js')
        expect(err.stack).to.not.contain('throw')
        expect(err.stack).to.not.contain('wrap')
        expect(err.data).to.contain(data)
        expect(err.data.err).to.deep.equal(errToJSON(origErr))
        done()
      }
    })

    describe('wrap', function () {
      it('should wrap an error w/out data', function (done) {
        const AppError = ctx.AppError
        const origErr = new Error('boom')
        const err = AppError.wrap(origErr)
        expect(err.data).to.deep.equal({ err: errToJSON(origErr) })
        done()
      })
    })
  })

  describe('toJSON', function () {
    it('should wrap an error w/out data', function (done) {
      const AppError = ctx.AppError
      const err = new AppError('boom')
      const errJSON = err.toJSON()
      expect(errJSON.data).to.be.an.object()
      expect(errJSON.data).to.deep.equal({})
      done()
    })

    it('should toJSON a nested error', function (done) {
      const AppError = ctx.AppError
      const err = new Error('boom')
      const err2 = AppError.wrap(err)
      const errJSON2 = err2.toJSON()
      expect(errJSON2).to.not.be.an.instanceOf(Error)
      expect(errJSON2).to.deep.contain({
        type: 'Error',
        message: 'boom',
        name: 'AppError',
        id: ctx.id,
        time: ctx.time
      })
      expect(errJSON2.stack).to.match(/^stack\n[ ]{4}--\n.*/)
      expect(errJSON2.data).to.be.an.object()
      expect(errJSON2.data.err).to.not.be.an.instanceOf(Error)
      expect(errJSON2.data.err).to.deep.contain({
        type: 'Error',
        message: 'boom',
        name: 'Error'
      })
      expect(errJSON2.data.err.stack).to.match(/^Error:.*/)
      expect(errJSON2.data.errs).to.be.an.array()
      expect(errJSON2.data.errs).to.deep.equal([errJSON2.data.err])
      const err3 = AppError.wrap(err2)
      const errJSON3 = err3.toJSON()
      expect(errJSON3).to.deep.contain({
        type: 'Error',
        message: 'boom',
        name: 'AppError',
        id: ctx.id,
        time: ctx.time
      })
      done()
    })
  })
})
