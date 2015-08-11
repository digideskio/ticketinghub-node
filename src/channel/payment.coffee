class Payment extends require('../resource')
  module.exports = this

  @path = '/channel/payments'

  @types
    paypal: require('./payment/paypal')
    stripe: require('./payment/stripe')
    ideal:  require('./payment/ideal')