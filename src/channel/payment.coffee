class Payment extends require('../resource')
  module.exports = this

  @path = '/channel/payments'

  @types
    credit: require('./payment/credit')
    stripe: require('./payment/stripe')