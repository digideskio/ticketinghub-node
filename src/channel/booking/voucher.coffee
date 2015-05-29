class VoucherBooking extends require('../booking')
  module.exports = this

  @path = '/channel/bookings'

  @collection 'vouchers', require('../voucher')