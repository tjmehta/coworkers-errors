'use strict'

const Code = require('code')
const Lab = require('lab')

const lab = exports.lab = Lab.script()
const describe = lab.describe
const it = lab.it
const expect = Code.expect

const assertDeepNative = require('../../lib/assert-deep-native.js')

describe('assertDeepNative', function () {
  it('should get retry\'s timeout', function (done) {
    const obj = {
      foo: 1,
      bar: 2
    }
    obj.circular = obj
    const out = assertDeepNative(obj)
    expect(out).to.deep.equal({
      foo: 1,
      bar: 2,
      circular: '[Circular]'
    })
    done()
  })
})
