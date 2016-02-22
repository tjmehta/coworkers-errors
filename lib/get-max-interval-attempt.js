'use strict'

const getRetryTimeout = require('./get-retry-timeout.js')

module.exports = getMaxIntervalAttempt

function getMaxIntervalAttempt (retryOpts) {
  if (retryOpts._maxIntervalAttempt) {
    return retryOpts._maxIntervalAttempt
  }
  var n = 1
  var product = 1
  while (product < retryOpts.maxInterval) {
    product = getRetryTimeout(n, retryOpts)
    n++
  }
  const maxAttempt = n - 1
  retryOpts._maxIntervalAttempt = maxAttempt
  return maxAttempt
}
