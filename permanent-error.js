'use strict'

const AppError = require('./app-error.js')
/**
 * PermanentError - error that is not retryable
 * @class
 */
module.exports = class PermanentError extends AppError {}
