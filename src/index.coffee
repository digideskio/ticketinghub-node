require './polyfill'

Endpoint = require './endpoint'
{ RequestError, ServerError, ConnectionError, ValidationError } = require './errors'

class TicketingHub
  @endpoint: new Endpoint('http://localhost:5000')

  @Channel: require('./channel/channel')

  @RequestError: RequestError
  @ServerError: ServerError
  @ConnectionError: ConnectionError
  @ValidationError: ValidationError

if module?.exports
  module.exports = 
    TicketingHub: TicketingHub
else global.TicketingHub = TicketingHub