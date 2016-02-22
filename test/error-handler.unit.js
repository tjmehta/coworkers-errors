'use strict'

const Code = require('code')
const errToJSON = require('utils-error-to-json')
const Lab = require('lab')
const noop = require('101/noop')
const put = require('101/put')
const set = require('101/set')
const proxyquire = require('proxyquire')
const sinon = require('sinon')
require('sinon-as-promised')

const lab = exports.lab = Lab.script()
const describe = lab.describe
const it = lab.it
const beforeEach = lab.beforeEach
const afterEach = lab.afterEach
const expect = Code.expect

const createErrorHandler = require('../error-handler.js')
const FatalError = require('../fatal-error.js')
const PermanentError = require('../permanent-error.js')
const RetryableError = require('../retryable-error.js')
const UnexpectedError = require('../unexpected-error.js')
const handlers = createErrorHandler
const silentLog = {
  error: noop
}
const mockChannel = function () {
  return {
    assertQueue: sinon.stub(),
    sendToQueue: sinon.stub(),
    ack: sinon.stub()
  }
}

describe('createErrorHandler', function () {
  let ctx
  beforeEach(function (done) {
    ctx = {}
    done()
  })

  it('should create an error handler', function (done) {
    createErrorHandler() // coverage
    createErrorHandler({ retry: { maxAttempts: 1 } }) // coverage
    const errorHandler = createErrorHandler({ log: silentLog })
    expect(errorHandler).to.be.a.function()
    expect(errorHandler.length).to.equal(2)
    done()
  })

  describe('errorHandler', function () {
    beforeEach(function (done) {
      sinon.stub(handlers, 'fatalErrorHandler')
      sinon.stub(handlers, 'permanentErrorHandler')
      sinon.stub(handlers, 'retryableErrorHandler')
      sinon.stub(handlers, 'unexpectedErrorHandler')
      done()
    })
    afterEach(function (done) {
      handlers.fatalErrorHandler.restore()
      handlers.permanentErrorHandler.restore()
      handlers.retryableErrorHandler.restore()
      handlers.unexpectedErrorHandler.restore()
      done()
    })

    it('should log the error', function (done) {
      const log = { error: sinon.stub() }
      const errorHandler = createErrorHandler({ log: log })
      const err = new UnexpectedError('boom')
      const errJSON = {}
      const contextJSON = {}
      sinon.stub(err, 'toJSON').returns(errJSON)
      const context = { toJSON: sinon.stub().returns(contextJSON) }
      errorHandler(err, context)
      sinon.assert.calledOnce(log.error)
      sinon.assert.calledWith(log.error, 'app error', {
        err: errJSON,
        context: contextJSON
      })
      done()
    })

    it('should handle a FatalError', function (done) {
      const errorHandler = createErrorHandler({ log: silentLog })
      const err = new FatalError('boom')
      const context = { toJSON: sinon.stub().returns({}) }
      errorHandler(err, context)
      sinon.assert.calledOnce(handlers.fatalErrorHandler)
      sinon.assert.calledWith(handlers.fatalErrorHandler, err, context)
      sinon.assert.notCalled(handlers.permanentErrorHandler)
      sinon.assert.notCalled(handlers.retryableErrorHandler)
      sinon.assert.notCalled(handlers.unexpectedErrorHandler)
      done()
    })

    it('should handle a PermanentError', function (done) {
      const errorHandler = createErrorHandler({ log: silentLog })
      const err = new PermanentError('boom')
      const context = { toJSON: sinon.stub().returns({}) }
      errorHandler(err, context)
      sinon.assert.calledOnce(handlers.permanentErrorHandler)
      sinon.assert.calledWith(handlers.permanentErrorHandler, err, context)
      sinon.assert.notCalled(handlers.fatalErrorHandler)
      sinon.assert.notCalled(handlers.retryableErrorHandler)
      sinon.assert.notCalled(handlers.unexpectedErrorHandler)
      done()
    })

    it('should handle a RetryableError', function (done) {
      const errorHandler = createErrorHandler({ log: silentLog })
      const err = new RetryableError('boom')
      const context = { toJSON: sinon.stub().returns({}) }
      errorHandler(err, context)
      sinon.assert.calledOnce(handlers.retryableErrorHandler)
      sinon.assert.calledWith(handlers.retryableErrorHandler, err, context)
      sinon.assert.notCalled(handlers.fatalErrorHandler)
      sinon.assert.notCalled(handlers.permanentErrorHandler)
      sinon.assert.notCalled(handlers.unexpectedErrorHandler)
      done()
    })

    it('should handle a UnexpectedError', function (done) {
      const errorHandler = createErrorHandler({ log: silentLog })
      const err = new UnexpectedError('boom')
      const context = { toJSON: sinon.stub().returns({}) }
      errorHandler(err, context)
      sinon.assert.calledOnce(handlers.unexpectedErrorHandler)
      sinon.assert.calledWith(handlers.unexpectedErrorHandler, err, context)
      sinon.assert.notCalled(handlers.fatalErrorHandler)
      sinon.assert.notCalled(handlers.permanentErrorHandler)
      sinon.assert.notCalled(handlers.retryableErrorHandler)
      done()
    })

    describe('real unexpected error', function () {
      beforeEach(function (done) {
        sinon.spy(UnexpectedError, 'wrap')
        done()
      })
      afterEach(function (done) {
        UnexpectedError.wrap.restore()
        done()
      })

      it('should handle real unexpected error', function (done) {
        const opts = { log: silentLog }
        const errorHandler = createErrorHandler(opts)
        const err = new Error('boom')
        const context = { toJSON: sinon.stub().returns({}) }
        errorHandler(err, context)
        sinon.assert.calledOnce(UnexpectedError.wrap)
        sinon.assert.calledWith(UnexpectedError.wrap, err)
        const matchWrapErr = sinon.match(function (wrappedErr) {
          expect(wrappedErr).to.be.an.instanceOf(UnexpectedError)
          expect(wrappedErr.data.err).to.deep.equal(errToJSON(err))
          return true
        })
        sinon.assert.calledOnce(handlers.unexpectedErrorHandler)
        sinon.assert.calledWith(handlers.unexpectedErrorHandler, matchWrapErr, context, opts)
        sinon.assert.notCalled(handlers.fatalErrorHandler)
        sinon.assert.notCalled(handlers.permanentErrorHandler)
        sinon.assert.notCalled(handlers.retryableErrorHandler)
        done()
      })
    })
  })

  describe('handlers', function () {
    beforeEach(function (done) {
      ctx.throwNextTick = sinon.stub()
      ctx.getMaxIntervalAttempt = sinon.stub()
      ctx.getRetryTimeout = sinon.stub()
      ctx.handlers = proxyquire('../error-handler.js', {
        'throw-next-tick': ctx.throwNextTick,
        './lib/get-max-interval-attempt.js': ctx.getMaxIntervalAttempt,
        './lib/get-retry-timeout.js': ctx.getRetryTimeout
      })
      ctx.retryableErrorHandler = ctx.handlers.retryableErrorHandler
      ctx.unexpectedErrorHandler = ctx.handlers.unexpectedErrorHandler
      // mock context
      ctx.contextJSON = {}
      ctx.context = {
        publisherChannel: mockChannel(),
        consumerChannel: mockChannel(),
        toJSON: sinon.stub().returns(ctx.contextJSON),
        queueName: 'queue',
        exchange: 'exchange',
        routingKey: 'routing-key',
        message: { content: 'content' },
        content: 'content',
        headers: {}
      }
      ctx.opts = {
        namespaces: {
          delimeter: '.',
          fatal: 'fatal-error',
          permanent: 'permanent-error',
          retryable: 'retryable-error'
        }
      }
      done()
    })

    describe('fatalErrorHandler', function () {
      it('should assert and publish to fatal-error queue, and throwNextTick fatalErr', function (done) {
        const err = new FatalError('boom')
        const errJSON = err.toJSON()
        const publisherChannel = ctx.context.publisherChannel
        publisherChannel.assertQueue.resolves()
        ctx.handlers.fatalErrorHandler(err, ctx.context, ctx.opts)
          .then(function () {
            sinon.assert.calledOnce(publisherChannel.assertQueue)
            sinon.assert.calledWith(publisherChannel.assertQueue, 'fatal-error.queue')
            sinon.assert.calledOnce(publisherChannel.sendToQueue)
            sinon.assert.calledWith(publisherChannel.sendToQueue, 'fatal-error.queue', {
              err: errJSON,
              context: ctx.context.toJSON()
            })
            sinon.assert.calledOnce(ctx.throwNextTick)
            const fatalErr = ctx.throwNextTick.args[0][0]
            expect(fatalErr).to.be.an.instanceOf(FatalError)
            expect(fatalErr.data.context).to.deep.equal(ctx.context.toJSON())
            done()
          })
          .catch(done)
      })
      describe('error', function () {
        beforeEach(function (done) {
          sinon.stub(FatalError, 'throwNextTick')
          done()
        })
        afterEach(function (done) {
          FatalError.throwNextTick.restore()
          done()
        })

        it('should fatal error if anything fails', function (done) {
          assertFatalError(ctx.handlers.fatalErrorHandler, done)
        })
      })
    })

    describe('permanentErrorHandler', function () {
      it('should assert and publish to permanent-error queue, and ack message', function (done) {
        const err = new PermanentError('boom')
        const errJSON = err.toJSON()
        const publisherChannel = ctx.context.publisherChannel
        const consumerChannel = ctx.context.consumerChannel
        publisherChannel.assertQueue.resolves()
        ctx.handlers.permanentErrorHandler(err, ctx.context, ctx.opts)
          .then(function () {
            sinon.assert.calledOnce(publisherChannel.assertQueue)
            sinon.assert.calledWith(publisherChannel.assertQueue, 'permanent-error.queue')
            sinon.assert.calledOnce(publisherChannel.sendToQueue)
            sinon.assert.calledWith(publisherChannel.sendToQueue, 'permanent-error.queue', {
              err: errJSON,
              context: ctx.context.toJSON()
            })
            sinon.assert.calledOnce(consumerChannel.ack)
            sinon.assert.calledWith(consumerChannel.ack, ctx.context.message)
            done()
          })
          .catch(done)
      })

      describe('error', function () {
        beforeEach(function (done) {
          sinon.stub(FatalError, 'throwNextTick')
          done()
        })
        afterEach(function (done) {
          FatalError.throwNextTick.restore()
          done()
        })

        it('should fatal error if anything fails', function (done) {
          assertFatalError(ctx.handlers.permanentErrorHandler, done)
        })
      })
    })

    describe('unexpectedErrorHandler', function () {
      beforeEach(function (done) {
        sinon.spy(RetryableError, 'wrap')
        sinon.stub(handlers, 'retryableErrorHandler')
        sinon.stub(FatalError, 'throwNextTick')
        done()
      })
      afterEach(function (done) {
        RetryableError.wrap.restore()
        handlers.retryableErrorHandler.restore()
        FatalError.throwNextTick.restore()
        done()
      })

      it('should wrap and pass err to retryable, then throwNextTick', function (done) {
        const err = new UnexpectedError('boom')
        const errJSON = err.toJSON()
        handlers.retryableErrorHandler.resolves()
        handlers.unexpectedErrorHandler(err, ctx.context, ctx.opts)
          .then(function () {
            sinon.assert.calledOnce(RetryableError.wrap)
            sinon.assert.calledWith(RetryableError.wrap, err)
            sinon.assert.calledOnce(handlers.retryableErrorHandler)
            const wrappedErr = handlers.retryableErrorHandler.args[0][0]
            expect(wrappedErr).to.be.an.instanceOf(RetryableError)
            expect(wrappedErr.data.err).to.deep.equal(errJSON)
            sinon.assert.calledOnce(FatalError.throwNextTick)
            sinon.assert.calledWith(FatalError.throwNextTick, err, { context: ctx.contextJSON })
            done()
          })
          .catch(done)
      })

      describe('error', function () {
        it('should fatal error if anything fails', function (done) {
          const err = new FatalError('fatal')
          const retryErr = new Error('assert failed')
          handlers.retryableErrorHandler.rejects(retryErr)
          handlers.unexpectedErrorHandler(err, ctx.context, ctx.opts)
            .then(function () {
              sinon.assert.calledOnce(FatalError.throwNextTick)
              sinon.assert.calledWith(FatalError.throwNextTick, retryErr)
              done()
            })
            .catch(done)
        })
      })
    })

    describe('retryableErrorHandler', function () {
      afterEach(function (done) {
        if (Date.now.restore) {
          Date.now.restore()
        }
        done()
      })

      it('should assert and publish to retry-queue and ack message', function (done) {
        const err = new RetryableError('boom')
        ctx.opts.retry = {
          startInterval: 10,
          multiplier: 10,
          maxInterval: 100,
          maxAttempts: Infinity
        }
        const publisherChannel = ctx.context.publisherChannel
        publisherChannel.assertQueue.resolves()
        const retryTimeout = 100
        ctx.getRetryTimeout.returns(retryTimeout)
        ctx.getMaxIntervalAttempt.returns(100)
        ctx.time = 1455916680303
        sinon.stub(Date, 'now').returns(ctx.time)
        ctx.handlers.retryableErrorHandler(err, ctx.context, ctx.opts)
          .then(function () {
            Date.now.restore()
            sinon.assert.calledOnce(ctx.getRetryTimeout)
            sinon.assert.calledWith(ctx.getRetryTimeout, ctx.opts.retry)
            sinon.assert.calledOnce(ctx.getMaxIntervalAttempt)
            sinon.assert.calledWith(ctx.getMaxIntervalAttempt, ctx.opts.retry)
            sinon.assert.calledOnce(publisherChannel.assertQueue)
            sinon.assert.calledWith(publisherChannel.assertQueue, 'retryable-error.queue')
            sinon.assert.calledOnce(publisherChannel.sendToQueue)
            const expectedProps = {
              headers: {
                'x-death': [{
                  count: 1,
                  reason: 'retryable-error', // non-standard: normally rejected or timeout
                  queue: ctx.context.queueName,
                  time: {
                    '!': 'timestamp',
                    'value': ctx.time
                  },
                  exchange: ctx.context.exchange,
                  'routing-keys': [ctx.context.routingKey].concat(ctx.context.headers.CC || []),
                  // non-standard
                  err: err.toJSON(),
                  context: set(ctx.context.toJSON(), { 'headers["x-death"]': '[Circular]' })
                }]
              },
              expiration: retryTimeout
            }
            sinon.assert.calledWith(publisherChannel.sendToQueue,
              'retryable-error.queue', ctx.context.content, expectedProps)
            done()
          })
          .catch(done)
      })

      describe('multiple retries', function () {
        describe('max retries', function () {
          beforeEach(function (done) {
            sinon.stub(ctx.handlers, 'permanentErrorHandler').resolves()
            done()
          })

          it('should recast to permanent error', function (done) {
            const err = new RetryableError('boom')
            ctx.opts.retry = {
              startInterval: 10,
              multiplier: 10,
              maxInterval: 100,
              maxAttempts: -1
            }
            const publisherChannel = ctx.context.publisherChannel
            publisherChannel.assertQueue.resolves()
            const retryTimeout = 100
            ctx.getRetryTimeout.returns(retryTimeout)
            ctx.getMaxIntervalAttempt.returns(100)
            ctx.handlers.retryableErrorHandler(err, ctx.context, ctx.opts)
              .then(function () {
                const expectPermananentErr = sinon.match(function (permanentErr) {
                  expect(permanentErr).to.be.an.instanceOf(PermanentError)
                  expect(permanentErr.data.err).to.deep.equal(err.toJSON())
                  return true
                })
                sinon.assert.calledOnce(ctx.handlers.permanentErrorHandler)
                sinon.assert.calledWith(ctx.handlers.permanentErrorHandler, expectPermananentErr, ctx.context, ctx.opts)
                done()
              })
              .catch(done)
          })
        })

        describe('maxIntervalAttempt and not first retry', function () {
          it('should use maxInterval and retry like normal', function (done) {
            const publisherChannel = ctx.context.publisherChannel
            const retryTimeout = 100
            ctx.getRetryTimeout.returns(retryTimeout)
            ctx.getMaxIntervalAttempt.returns(2)
            ctx.time = 1455916680303
            sinon.stub(Date, 'now').returns(ctx.time)
            publisherChannel.assertQueue.resolves()
            const err = new RetryableError('boom')
            ctx.opts.retry = {
              startInterval: 10,
              multiplier: 10,
              maxInterval: 100,
              maxAttempts: Infinity
            }
            ctx.context.headers.CC = ['routing-key2']
            const firstDeathHeader = {
              count: 1,
              reason: 'retryable-error', // non-standard: normally rejected or timeout
              queue: ctx.context.queueName,
              time: {
                '!': 'timestamp',
                'value': ctx.time
              },
              exchange: ctx.context.exchange,
              'routing-keys': [ctx.context.routingKey].concat(ctx.context.headers.CC),
              // non-standard
              err: err.toJSON(),
              context: set(ctx.context.toJSON(), 'headers["x-death"]', '[Circular]')
            }
            ctx.context.headers['x-death'] = [firstDeathHeader]
            ctx.handlers.retryableErrorHandler(err, ctx.context, ctx.opts)
              .then(function () {
                Date.now.restore()
                sinon.assert.notCalled(ctx.getRetryTimeout)
                sinon.assert.calledOnce(ctx.getMaxIntervalAttempt)
                sinon.assert.calledWith(ctx.getMaxIntervalAttempt, ctx.opts.retry)
                sinon.assert.calledOnce(publisherChannel.assertQueue)
                sinon.assert.calledWith(publisherChannel.assertQueue, 'retryable-error.queue')
                sinon.assert.calledOnce(publisherChannel.sendToQueue)
                const expectedProps = {
                  headers: {
                    CC: ctx.context.headers.CC,
                    'x-death': [{
                      count: 1,
                      reason: 'retryable-error', // non-standard: normally rejected or timeout
                      queue: ctx.context.queueName,
                      time: {
                        '!': 'timestamp',
                        'value': ctx.time
                      },
                      exchange: ctx.context.exchange,
                      'routing-keys': [ctx.context.routingKey].concat(ctx.context.headers.CC),
                      // non-standard
                      err: err.toJSON(),
                      context: set(ctx.context.toJSON(), { 'headers["x-death"]': '[Circular]' })
                    }, firstDeathHeader]
                  },
                  expiration: retryTimeout
                }
                sinon.assert.calledWith(publisherChannel.sendToQueue,
                  'retryable-error.queue', ctx.context.content, expectedProps)
                done()
              })
              .catch(done)
          })
        })
      })

      describe('error', function () {
        beforeEach(function (done) {
          sinon.stub(FatalError, 'throwNextTick')
          done()
        })
        afterEach(function (done) {
          FatalError.throwNextTick.restore()
          done()
        })

        it('should fatal error if anything fails', function (done) {
          ctx.opts.retry = {
            startInterval: 10,
            multiplier: 10,
            maxInterval: 100,
            maxAttempts: Infinity
          }
          assertFatalError(ctx.handlers.retryableErrorHandler, done)
        })
      })
    })
  })

  function assertFatalError (errorHandler, done) {
    const err = new FatalError('fatal')
    const publisherChannel = ctx.context.publisherChannel
    const assertErr = new Error('assert failed')
    publisherChannel.assertQueue.rejects(assertErr)
    errorHandler(err, ctx.context, ctx.opts)
      .then(function () {
        sinon.assert.calledOnce(FatalError.throwNextTick)
        sinon.assert.calledWith(FatalError.throwNextTick, assertErr)
        done()
      })
      .catch(done)
  }
})
