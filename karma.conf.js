'use strict'

module.exports = (config) => {
  config.set({
    basePath: '',
    frameworks: [ 'tap', 'browserify' ],
    files: [ 'test/*.js' ],

    preprocessors: {
      'test/*.js': [ 'browserify' ]
    },

    webpackMiddleware: {
      noInfo: true
    },

    reporters: [ 'tape' ],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: process.env.TRAVIS ? ['Firefox'] : ['Chrome'],
    singleRun: false
  })
}
