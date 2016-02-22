const memo = require('memoizee')

module.exports = memo(getRetryTimeout)

module.exports.getRetryTimeout // for testing! (w/out memo)

function getRetryTimeout (retryCount, retryOpts) {
  return retryOpts.startInterval * Math.pow(retryOpts.multiplier, retryCount)
}
