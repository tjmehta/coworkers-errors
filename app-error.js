'use strict'

const assert = require('assert')

const errToJSON = require('utils-error-to-json')
const put = require('101/put')
const uuid = require('uuid')

const assertDeepNative = require('./lib/assert-deep-native.js')
const dateNow = require('./lib/date-now.js') // for easier stubbing
const isError = require('./lib/is-error.js')

/**
 * AppErr - application error base class
 * @class
 */
module.exports = class AppError extends Error {
  /**
   * create an app error
   * @constructor
   * @param  {String} message error message
   * @param  {Object} data    additional debug data
   * @return {Error}          error instance
   */
  constructor (message, data) {
    super(message)
    data = data || {}
    this.id = (data.err && data.err.id) || uuid()
    this.name = this.constructor.name
    this.time = dateNow()
    this.data = assertDeepNative(data, 'data')
    // create this.stack
    Error.captureStackTrace(this, this.constructor)
    if (data.err) {
      this.stack += '\n    --\n' + data.err.stack.replace(/^[^\n]*\n/, '')
    }
  }
  /**
   * wrap and throw the error
   * @param  {Error} err error
   * @throws {*Error} wrapped error
   */
  static throw (err, data) {
    assert(isError(err), '"err" must be an Error')
    const newErr = this.wrap(err, data)
    // adjust stack
    newErr.stack = newErr.stack.replace(/^([^\n]*\n)(.*throw[^\n]+\n)/, '$1')
    throw newErr
  }
  /**
   * wrap the error w/ "this" class
   * @param  {Error} err error
   * @returns {*Error} wrapped error
   */
  static wrap (err, data) {
    assert(isError(err), '"err" must be an Error')
    data = data || {}
    data = put(data, { err: err })
    const newErr = new this(err.message, data)
    // adjust stack
    newErr.stack = newErr.stack.replace(/^([^\n]*\n)(.*wrap[^\n]+\n)/, '$1')
    return newErr
  }
  /**
   * return all nested errors as an array
   * @return {Array} array of json errors
   */
  static flatten (ptr) {
    const errs = []
    errs.push(ptr)

    while (ptr.data && ptr.data.err) {
      errs.push(ptr.data.err)
      ptr = ptr.data.err
    }

    return errs
  }
  /**
   * convert error to json
   * @return {Object} json err
   */
  toJSON () {
    const json = errToJSON(this)
    let ptr = json.data

    while (ptr && ptr.err) {
      ptr = ptr.err.data
    }
    if (json.data.err) {
      json.data.errs = AppError.flatten(json).slice(1) // slice removes self
    }

    return json
  }
}
