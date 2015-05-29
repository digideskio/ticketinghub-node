Promise = require('es6-promise').Promise;
Endpoint = require '../endpoint'

class Order extends require('../resource')
  module.exports = this

  @path = '/channel/orders'

  @collection 'payments', require('./payment')
  @collection 'bookings', require('./booking')

  confirm: ->
    @_endpoint.post('confirm')
      .then (response) => @_setup response.body
      .catch TicketingHub.RequestError, (error) =>
        if error.response.status == 422
          throw new TicketingHub.ValidationError @klass.load(@endpoint, error.response.body)
        else throw error