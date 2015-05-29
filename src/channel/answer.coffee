class Answer extends require('../resource')
  module.exports = this

  @path = '/channel/answers'

  @association 'question', require('./question')