/* eslint-env mocha */
'use strict'

const expect = require('chai').expect
const bl = require('bl')

const blob = require('../src')

describe('idb-plus-blob-store', () => {
  let store

  before(() => {
    store = blob()
  })

  describe('createWriteStream', () => {
    it('can write over an existing key', (done) => {
      const key = 'hello.txt'
      const input1 = 'hello'
      const input2 = 'world'

      const ws1 = store.createWriteStream({key}, (err, blob) => {
        expect(err).to.not.exist
        expect(blob.key).to.be.eql(key)

        const ws2 = store.createWriteStream({key}, (err, blob) => {
          expect(err).to.not.exist
          expect(blob.key).to.be.eql(key)

          const rs = store.createReadStream(blob)
          rs.pipe(bl((err, res) => {
            expect(err).to.not.exist
            expect(res.toString()).to.be.eql(input2)
            done()
          }))
        })

        ws2.write(input2)
        ws2.end()
      })

      ws1.write(input1)
      ws1.end()
    })

    it('throws on missing key', (done) => {
      store.createWriteStream({}, (err, blob) => {
        expect(err.message).to.be.eql('Missing key')
        done()
      })
    })

    it('uses name as key', (done) => {
      const name = 'hello.txt'
      const ws = store.createWriteStream({name}, (err, blob) => {
        expect(err).to.not.exist
        expect(blob.key).to.be.eql(name)
        done()
      })
      ws.end()
    })
  })

  describe('createReadStream', () => {
    it('throws on missing key', () => {
      expect(
        () => store.createReadStream({})
      ).to.throw(
        'Missing key'
      )
    })

    it('uses name as key', (done) => {
      const name = 'hello.txt'
      const ws = store.createWriteStream({name}, (err, blob) => {
        expect(err).to.not.exist
        expect(blob.key).to.be.eql(name)

        const rs = store.createReadStream({name})

        rs.pipe(bl((err, res) => {
          expect(err).to.not.exist
          expect(res.toString()).to.be.eql('hello')

          done()
        }))
      })

      ws.write('hello')
      ws.end()
    })
  })
})
