'use strict'

const AppError = require('./app-error.js')
/**
 * RetryableError - error that is retryable
 * @class
 */
module.exports = class RetryableError extends AppError {}
