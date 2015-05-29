class Channel extends require('../resource')
  module.exports = this

  @path = '/channel'
  @singleton = true

  @collection 'vouchers', require('./voucher')
  @collection 'coupons', require('./coupon')
  @collection 'tiers', require('./tier')
  @collection 'variants', require('./variant')
  @collection 'extras', require('./extra')
  @collection 'questions', require('./question')
  @collection 'bookings', require('./booking')
  @collection 'orders', require('./order')
  @collection 'options', require('./option')

  @association 'product', require('./product')

  @login: (token) ->
    TicketingHub.endpoint.base(@path, token).get().then (response) =>
      @load TicketingHub.endpoint.join(@path, token), response.body