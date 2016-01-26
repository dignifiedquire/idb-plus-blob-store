var db = require('db.js')
var isUndefined = require('lodash.isUndefined')
var through = require('through2')
var bl = require('bl')
var from = require('from2')
var toBuffer = require('typedarray-to-buffer')

function noop () {}

function Blobs (opts) {
  if (!(this instanceof Blobs)) return new Blobs(opts)
  this.opts = !isUndefined(opts) ? opts : {}
  this.opts.name = !isUndefined(this.opts.name) ? this.opts.name : 'idb-plus-blob-store'

  var schema = {}
  schema[this.opts.name] = {}

  var self = this

  this._store = db.open({
    server: self.opts.name,
    version: 1,
    schema: schema
  }).then(function (server) {
    return server[self.opts.name]
  })
}

module.exports = Blobs

Blobs.prototype.createWriteStream = function (opts, cb) {
  if (typeof opts === 'function') opts = {}
  if (typeof opts === 'string') opts = {key: opts}
  if (!cb) cb = noop

  var self = this
  var result = through()

  var key = !isUndefined(opts.key) ? opts.key : 'undefined'

  var error = function (err) {
    cb(err)
    result.destroy(err)
  }

  var ready = function () {
    result.pipe(bl(function (err, data) {
      if (err) return error(err)

      self._store
        .then(function (server) {
          return server.add({
            key: key,
            item: data
          })
        })
        .then(function () {
          cb(null, {
            key: key,
            size: data.length
          })
        }, error)
    }))
  }

  this._store
    .then(function (server) {
      return server.get(key)
        .then(function (data) {
          if (data) return server.remove(key)
        })
    })
    .then(ready, error)

  return result
}

Blobs.prototype.createReadStream = function (opts) {
  if (typeof opts === 'string') opts = {key: opts}

  var self = this
  var key = !isUndefined(opts.key) ? opts.key : 'undefined'

  var fetched = false
  var result = from(function (size, next) {
    if (fetched) return next(null, null)

    self._store
      .then(function (server) {

        return server.get(key)
      })
      .then(function (result) {
        if (!result) throw new Error('key not found: ' + key)

        fetched = true
        next(null, toBuffer(result))
      })
      .catch(function (err) {
        fetched = true
        next(err)
      })
  })

  result.resume()

  return result
}

Blobs.prototype.exists = function (opts, cb) {
  if (typeof opts === 'string') opts = {key: opts}
  if (!cb) cb = noop

  var key = !isUndefined(opts.key) ? opts.key : 'undefined'

  this._store
    .then(function (server) {
      return server.get(key)
    })
    .then(function (result) {
      if (result) return cb(null, true)
      cb(null, false)
    })
    .catch(cb)
}

Blobs.prototype.remove = function (opts, cb) {
  if (typeof opts === 'string') opts = {key: opts}
  if (!cb) cb = noop

  var key = !isUndefined(opts.key) ? opts.key : 'undefined'

  this._store
    .then(function (server) {
      return server.remove(key)
    })
    .then(function () {
      cb()
    }, cb)
}
