'use strict'

const assert = require('assert')

const co = require('co')
const defaults = require('101/defaults')
const hasProps = require('101/has-properties')
const set = require('101/set')
const isPositiveInteger = require('is-positive-integer')
const throwNextTick = require('throw-next-tick')

const FatalError = require('./fatal-error')
const PermanentError = require('./permanent-error')
const RetryableError = require('./retryable-error')
const UnexpectedError = require('./unexpected-error')
const getMaxIntervalAttempt = require('./lib/get-max-interval-attempt.js')
const getRetryTimeout = require('./lib/get-retry-timeout.js')

module.exports = createErrorHandler

/**
 * create error handler
 * @param  {Object} [opts] error handler options
 * @param  {Object} [opts.log] custom logger (must have log.error), default: console
 * @param  {Object} [opts.namespaces] namespaces which to create dead-letter-queues w/
 * @param  {String} [opts.namespaces.delimeter] namespace delimeter, default: '.'
 * @param  {String} [opts.namespaces.fatal] fatal queue namespace, default: 'fatal-error'
 * @param  {String} [opts.namespaces.permanent] permanent queue namespace, default: 'permanent-error'
 * @param  {String} [opts.namespaces.retryable] permanent queue namespace, default: 'retryable-error'
 * @param  {Object} [opts.retry] retry back-off options
 * @param  {Integer} [opts.retry.startInterval] retry back-off start interval in ms, default: 200
 * @param  {Integer} [opts.retry.multiplier] retry back-off multiplier in ms, default: 4
 * @param  {Integer} [opts.retry.maxAttempts] max number of retry attempts, default: Infinity
 * @return {Function} error handler
 */
function createErrorHandler (opts) {
  // default options
  opts = opts || {}
  defaults(opts, {
    log: console,
    namespaces: {},
    retry: {}
  })
  defaults(opts.namespaces, {
    delimeter: '.',
    fatal: 'fatal-error',
    permanent: 'permanent-error',
    retryable: 'retryable-error'
  })
  defaults(opts.retry, {
    startInterval: 200,
    multiplier: 4,
    maxInterval: 16 * 1000,
    maxAttempts: Infinity
  })
  // validate opts
  const retryOpts = opts.retry
  assert(retryOpts.maxInterval >= retryOpts.startInterval, '"retry.maxInterval" must be greater than or equal to "startInterval"')
  assert(isPositiveInteger(retryOpts.startInterval), '"retry.startInterval" must be a positive integer')
  assert(isPositiveInteger(retryOpts.multiplier), '"retry.multiplier" must be a positive integer')
  assert(isPositiveInteger(retryOpts.maxInterval), '"retry.maxInterval" must be a positive integer')
  assert(retryOpts.maxAttempts === Infinity || isPositiveInteger(retryOpts.maxAttempts), '"retry.maxAttempts" must be a positive integer')
  // logger
  const log = opts.log
  assert(log.error, '"log" must have an "error" method')
  // return error handler
  return function errorHandler (err, context) {
    if (err instanceof FatalError) {
      logErr(err)
      module.exports.fatalErrorHandler(err, context, opts)
    } else if (err instanceof PermanentError) {
      logErr(err)
      module.exports.permanentErrorHandler(err, context, opts)
    } else if (err instanceof RetryableError) {
      logErr(err)
      module.exports.retryableErrorHandler(err, context, opts)
    } else {
      err = err instanceof UnexpectedError
        ? err
        : UnexpectedError.wrap(err) // wrap as unexpected error
      logErr(err)
      module.exports.unexpectedErrorHandler(err, context, opts)
    }
    function logErr (err) {
      log.error('app error', {
        err: err.toJSON(),
        context: context.toJSON()
      })
    }
  }
}

/**
 * fatal error handler
 * saves error to fatal-error dead-letter queue (which it creates) and throws the fatal error as uncaught exception
 * @param  {FatalError} err fatal error
 * @param  {Context} context coworkers message context
 * @param  {Object} opts error handler options
 * @returns  {Promise} for testing
 */
module.exports.fatalErrorHandler = fatalErrorHandler
function fatalErrorHandler (err, context, opts) {
  return co(function * () {
    const fatalQueueName = opts.namespaces.fatal + opts.namespaces.delimeter + context.queueName
    yield context.publisherChannel.assertQueue(fatalQueueName)
    context.publisherChannel.sendToQueue(fatalQueueName, {
      err: err.toJSON(),
      context: context.toJSON()
    })
    err.data.context = context.toJSON()
    throwNextTick(err) // throw the FatalError
  }).catch(FatalError.throwNextTick)
}
/**
 * permanent error handler
 * saves error to permanent-error dead-letter queue (which it creates)
 * @param  {FatalError} err fatal error
 * @param  {Context} context coworkers message context
 * @param  {Object} opts error handler options
 * @returns  {Promise} for testing
 */
module.exports.permanentErrorHandler = permanentErrorHandler
function permanentErrorHandler (err, context, opts) {
  return co(function * () {
    const permanentQueueName = opts.namespaces.permanent + opts.namespaces.delimeter + context.queueName
    yield context.publisherChannel.assertQueue(permanentQueueName)
    context.publisherChannel.sendToQueue(permanentQueueName, {
      err: err.toJSON(),
      context: context.toJSON()
    })
    context.consumerChannel.ack(context.message)
  }).catch(FatalError.throwNextTick)
}
/**
 * retryable error handler
 * saves error to permanent-error dead-letter queue (which it creates)
 * @param  {FatalError} err fatal error
 * @param  {Context} context coworkers message context
 * @param  {Object} opts error handler options
 * @returns  {Promise} for testing
 */
module.exports.retryableErrorHandler = retryableErrorHandler
function retryableErrorHandler (err, context, opts) {
  return co(function * () {
    const retryOpts = opts.retry
    const headers = context.headers
    headers['x-death'] = headers['x-death'] || []
    const retryCount = headers['x-death']
      .filter(hasProps({ // filter out any timeout deaths, retryable-queue and "this queue"
        'reason': 'retryable-error',
        'queue': context.queueName
      }))
      .length + 1
    const maxIntervalAttempt = getMaxIntervalAttempt(retryOpts)

    if (retryCount < retryOpts.maxAttempts) {
      const retryQueueName = opts.namespaces.retryable + opts.namespaces.delimeter + context.queueName
      const props = {
        headers: headers,
        expiration: retryCount >= maxIntervalAttempt
          ? retryOpts.maxInterval
          : getRetryTimeout(retryOpts)
      }
      headers['x-death'].unshift({
        count: 1,
        reason: 'retryable-error', // non-standard: normally "rejected" or "timeout"
        exchange: context.exchange,
        queue: context.queueName,
        'routing-keys': [context.routingKey].concat(context.headers.CC || []),
        time: {
          '!': 'timestamp',
          'value': Date.now()
        },
        // non-standard
        err: err.toJSON(),
        context: set(context.toJSON(), 'headers["x-death"]', '[Circular]')
      })
      yield context.publisherChannel.assertQueue(retryQueueName)
      context.publisherChannel.sendToQueue(retryQueueName, context.content, props)
      context.consumerChannel.ack(context.message)
    } else {
      err = new PermanentError('max retry attempts reached', { err: err, opts: opts })
      yield module.exports.permanentErrorHandler(err, context, opts)
    }
  }).catch(FatalError.throwNextTick)
}
/**
 * unexpected error handler
 * error handler for any unexpected errors
 * @param  {Error} err unexpected error
 * @param  {Context} context coworkers message context
 * @param  {Object} opts error handler options
 * @returns  {Promise} for testing
 */
module.exports.unexpectedErrorHandler = unexpectedErrorHandler
function unexpectedErrorHandler (err, context, opts) {
  return co(function * () {
    // retry the message
    yield module.exports.retryableErrorHandler(RetryableError.wrap(err), context, opts)
    // kill process
    FatalError.throwNextTick(err, { context: context.toJSON() })
  }).catch(FatalError.throwNextTick)
}
