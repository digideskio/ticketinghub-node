class Booking extends require('../resource')
  module.exports = this

  @path = '/channel/bookings'

  @types
    ticket: require('./booking/ticket')
    voucher: require('./booking/voucher')

  @collection 'answers', require('./answer')
  @collection 'purchases', require('./purchase')