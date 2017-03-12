'use strict'

const assert = require('assert')

const throwNextTick = require('throw-next-tick')

const AppError = require('./app-error.js')
const isError = require('./lib/is-error.js')

/**
 * FatalError - error that should kill the process
 * @class
 */
module.exports = class FatalError extends AppError {
  /**
   * wrap and throw-next-tick the error
   * @param  {Error} err error
   * @throws {*Error} wrapped error
   */
  static throwNextTick (err, data) {
    assert(isError(err), '"err" must be an Error')
    const newErr = FatalError.wrap(err, data)
    // adjust stack
    newErr.stack = newErr.stack.replace(/^([^\n]*\n)(.*throwNextTick[^\n]+\n)/, '$1')
    throwNextTick(newErr)
  }
}
