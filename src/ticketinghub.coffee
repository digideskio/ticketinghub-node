{ RequestError, ServerError, ConnectionError, ValidationError } = require './errors'

class TicketingHub
  module.exports = this

  @API: require('./api')

  @Promise: require('yaku')
  @JSON: require('json3')

  @RequestError: RequestError
  @ServerError: ServerError
  @ConnectionError: ConnectionError
  @ValidationError: ValidationError
  @TicketingHub: TicketingHub

Endpoint = require('./endpoint')
TicketingHub.endpoint = new Endpoint 'https://api.ticketinghub.com'