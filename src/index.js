var db = require('db.js')
var isUndefined = require('lodash.isUndefined')
var from = require('from2')
var toBuffer = require('typedarray-to-buffer')
var Transform = require('stream').Transform
var util = require('util')

function noop () {}

function Blobs (opts) {
  if (!(this instanceof Blobs)) return new Blobs(opts)
  this.opts = !isUndefined(opts) ? opts : {}
  if (typeof opts === 'string') this.opts = { name: opts }
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
  var key = !isUndefined(opts.key) ? opts.key : 'undefined'

  var FlushableStream = function (options) {
    Transform.call(this, options)
    this._bufs = []
  }

  util.inherits(FlushableStream, Transform)

  FlushableStream.prototype._transform = function (chunk, encoding, done) {
    console.log('--transforming')
    // coerce number arguments to strings, since Buffer(number) does
    // uninitialized memory allocation
    if (typeof buf === 'number') chunk = chunk.toString()

    this._bufs.push(Buffer.isBuffer(chunk) ? chunk : new Buffer(chunk))
    this.push(chunk)

    if (done) done()
  }

  FlushableStream.prototype._flush = function (done) {
    console.log('--flushing')
    var data = this._bufs.slice()
    var server
    self._store
      .then(function (s) {
        server = s
      })
      .then(function () {
        return server.get(key)
      })
      .then(function (data) {
        if (data) return server.remove(key)
      })
      .then(function () {
        return server.add({
          key: key,
          item: data
        })
      })
      .then(function () {
        console.log('--wrote', key)
        cb(null, {
          key: key,
          size: data.length
        })
        done()
      })
      .catch(done)
  }

  var res = new FlushableStream()
  res.resume()

  return res
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
        console.log(result)
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
