const test = require('tape')
const blob = require('../src/')

require('abstract-blob-store/tests')(test, {
  setup (t, cb) {
    cb(null, blob())
  },
  teardown (t, store, obj, cb) {
    if (obj) {
      store.remove(obj, cb)
    } else {
      cb()
    }
  }
})
