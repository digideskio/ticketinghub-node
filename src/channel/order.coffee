Promise = require('../index').Promise;

class Order extends require('../resource')
  module.exports = this

  @path = '/channel/orders'

  @collection 'payments', require('./payment')
  @collection 'bookings', require('./booking')

  confirm: ->
    @_endpoint.post('confirm')
      .then (response) => @_setup response.body
      .catch (error) =>
        if (error instanceof TicketingHub.RequestError) || error.response.status == 422
          throw new TicketingHub.ValidationError @constructor.load(@_endpoint, error.response.body)
        else throw error