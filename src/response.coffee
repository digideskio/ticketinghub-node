class Response
  module.exports = this

  constructor: (@status, @body, headers = {}) ->
    @headers = {}
    for key, value of headers
      @headers[key.toLowerCase()] = value