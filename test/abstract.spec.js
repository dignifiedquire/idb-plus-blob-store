/* eslint-env mocha */
'use strict'

const tape = require('tape')
const tests = require('abstract-blob-store/tests')

const blob = require('../src/')

describe('abstract-blob-store', () => {
  it('works', (done) => {
    const common = {
      setup (t, cb) {
        cb(null, blob())
      },
      teardown (t, store, obj, cb) {
        if (obj) return store.remove(obj, cb)
        cb()
      }
    }

    tape.onFinish(done)
    tests(tape, common)
  })
})
