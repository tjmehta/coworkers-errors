'use strict'

const AppError = require('./app-error.js')
/**
 * UnexpectedError - error that was not expected to occur - no class
 * @class
 */
module.exports = class UnexpectedError extends AppError {}
