var db = require('db.js')
var isUndefined = require('lodash.isundefined')
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
    this._evilIsFlushing = false
    this._evilPending = 0
    this._evilWantFinish = false
    this._evilFlushed = false
  }

  util.inherits(FlushableStream, Transform)

  FlushableStream.prototype._transform = function (chunk, encoding, done) {
    this._evilPending++
    // coerce number arguments to strings, since Buffer(number) does
    // uninitialized memory allocation
    if (typeof buf === 'number') chunk = chunk.toString()

    this._bufs.push(Buffer.isBuffer(chunk) ? chunk : new Buffer(chunk))
    this.push(chunk)

    this._evilPending--
    if (done) done()
  }

  FlushableStream.prototype._flush = function (done) {
    this._evilIsFlushing = true

    var innerSelf = this
    var finish = function (err) {
      innerSelf._evilIsFlushing = false
      innerSelf._evilFlushed = true
      innerSelf.emit('_evilFlush')
      if (done) done(err)
    }

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
        cb(null, {
          key: key,
          size: data.length
        })
        finish()
      })
      .catch(finish)
  }

  FlushableStream.prototype.emit = function (event) {
    var innerSelf = this
    var args = arguments

    var emit = function () {
      Transform.prototype.emit.apply(innerSelf, args)
    }

    switch (event) {
      case 'finish':
        // Flush finished?
        if (this._evilFlushed) {
          // Flushing done
          emit()
        } else if (this._evilIsFlushing) {
          // Flushing in process
          return
        } else {
          // Start flushing
          this._flush()
        }
        break
      case '_evilFlush':
        this.emit('finish')
        break
      default:
        emit()
    }
  }

  return new FlushableStream()
}

Blobs.prototype.createReadStream = function (opts) {
  if (typeof opts === 'string') opts = {key: opts}

  var self = this
  var key = !isUndefined(opts.key) ? opts.key : 'undefined'

  var buf = null
  var result = from(function (size, next) {
    if (!buf) {
      return self._store
        .then(function (server) {
          return server.get(key)
        })
        .then(function (result) {
          if (!result) throw new Error('key not found: ' + key)

          buf = result
          const nextPart = buf.pop()

          next(null, toBuffer(nextPart))
        })
        .catch(function (err) {
          next(err)
        })
    }

    if (buf.length === 0) return next(null, null)

    next(null, toBuffer(buf.pop()))
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
