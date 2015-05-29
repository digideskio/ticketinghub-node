class Response
  
  constructor: (@status, body = '', headers = {}) ->
    @headers = {}
    for key, value of headers
      @headers[key.toLowerCase()] = value

    if /json/.test @headers['content-type']
      body = JSON.parse body

    @body = body

module.exports = Response