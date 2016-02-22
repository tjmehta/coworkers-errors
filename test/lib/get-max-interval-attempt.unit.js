'use strict'

const Code = require('code')
const Lab = require('lab')

const lab = exports.lab = Lab.script()
const describe = lab.describe
const it = lab.it
const expect = Code.expect

const getMaxIntervalAttempt = require('../../lib/get-max-interval-attempt.js')

describe('getMaxIntervalAttempt', function () {
  it('should get the max interval attempt', function (done) {
    const maxAttempt = getMaxIntervalAttempt({
      startInterval: 10,
      multiplier: 10,
      maxInterval: 100
    })
    expect(maxAttempt).to.equal(1)
    done()
  })
  it('should get the max interval attempt again (from cache)', function (done) {
    const opts = {
      startInterval: 95,
      multiplier: 2,
      maxInterval: 800
    }
    let maxAttempt
    maxAttempt = getMaxIntervalAttempt(opts)
    expect(maxAttempt).to.equal(4)
    expect(opts._maxIntervalAttempt).to.equal(4)
    maxAttempt = getMaxIntervalAttempt(opts)
    expect(maxAttempt).to.equal(4)
    done()
  })
})
