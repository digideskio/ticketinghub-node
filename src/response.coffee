TicketingHub = require './ticketinghub'

class Response
  module.exports = this

  constructor: (@status, body = '', headers = {}) ->
    @headers = {}
    for key, value of headers
      @headers[key.toLowerCase()] = value

    if /json/.test @headers['content-type']
      body = TicketingHub.JSON.parse body

    @body = body