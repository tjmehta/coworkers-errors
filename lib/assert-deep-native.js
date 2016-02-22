'use strict'

const assert = require('assert')

const directInstanceOf = require('direct-instance-of')
const errToJSON = require('utils-error-to-json')
const map = require('object-loops/map')
var isNative = require('native-types').isNative
const isNumber = require('101/is-number')

module.exports = assertDeepNative

function assertDeepNative (val, keypath) {
  val = (val && val.toJSON) ? val.toJSON() : val
  assert(isNative(val), `"${keypath}" must be native js type`)
  if (val instanceof Error) {
    val = errToJSON(val)
  }
  if (directInstanceOf(val, Object) || Array.isArray(val)) {
    return map(val, function (val, key) {
      const childKeypath = keypath + (isNumber(key) ? `[${key}]` : `.${key}`)
      return assertDeepNative(val, childKeypath)
    })
  }

  return val
}
