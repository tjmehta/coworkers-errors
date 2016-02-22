'use strict'

const Code = require('code')
const Lab = require('lab')

const lab = exports.lab = Lab.script()
const describe = lab.describe
const it = lab.it
const expect = Code.expect

const getRetryTimeout = require('../../lib/get-retry-timeout.js')

describe('getRetryTimeout', function () {
  it('should get retry\'s timeout', function (done) {
    const timeout = getRetryTimeout(1, {
      startInterval: 10,
      multiplier: 10
    })
    expect(timeout).to.equal(100)
    done()
  })

  it('should get retry\'s timeout', function (done) {
    const timeout = getRetryTimeout(2, {
      startInterval: 10,
      multiplier: 5
    })
    expect(timeout).to.equal(250)
    done()
  })
})
