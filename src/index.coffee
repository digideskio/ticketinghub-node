require './polyfill'

Endpoint = require './endpoint'
{ RequestError, ServerError, ConnectionError, ValidationError } = require './errors'

class TicketingHub
  @endpoint: new Endpoint('https://api.ticketinghub.com')

  @Channel: require('./channel/channel')

  @RequestError: RequestError
  @ServerError: ServerError
  @ConnectionError: ConnectionError
  @ValidationError: ValidationError

if typeof global.window isnt 'undefined'
  global.window.TicketingHub = TicketingHub
else module.exports = TicketingHub: TicketingHub