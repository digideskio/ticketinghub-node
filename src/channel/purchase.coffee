class Purchase extends require('../resource')
  module.exports = this

  @path = '/channel/purchases'

  @association 'extra', require('./extra')