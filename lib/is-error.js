module.exports = isError

function isError (err) {
  return Boolean(err && err.stack)
}
