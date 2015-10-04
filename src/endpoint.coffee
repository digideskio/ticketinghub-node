extend = require('./util').extend
Response = require './response'
util = require './util'
TicketingHub = require './ticketinghub'

join = (args...) ->
  args.join('/')
    .replace(/[\/]+/g, '/')
    .replace(/\/\?/g, '?')
    .replace(/\/\#/g, '#')
    .replace(/\:\//g, '://')
    .replace(/\/$/g, '')

class Endpoint
  module.exports = this

  TIMEOUT = 10 * 1000
  RETRIES = 6

  constructor: (@origin, @path = '', @auth = '') ->
    @url = join @origin, @path

  base: (path, auth = @auth) ->
    new Endpoint @origin, path, auth

  join: (path, auth = @auth) ->
    new Endpoint @origin, join(@path, path), auth

  for method in ['head', 'get', 'post', 'patch', 'delete'] then do (method) =>
    @::[method] = (path, params) ->
      [path, params] = [params, path] unless typeof path == 'string'
      @request method, path, params

  request: (method, path = '', params) ->
    id = util.generateUUID()
    href = if path[0] == '/' then join(@origin, path) else if path then join(@url, path) else @url

    new TicketingHub.Promise (resolve, reject) =>
      json_params = encodeURIComponent TicketingHub.JSON.stringify(params || {})
      query = "?_id=#{id}&_json=#{json_params}&_method=#{method.toLowerCase()}"
      href = "#{href}.json" unless href.match /\.json$/

      handle = (response) ->
        if 400 <= response.status < 500
          reject new TicketingHub.RequestError(response)
        else if 500 <= response.status < 600
          reject new TicketingHub.ServerError(response)
        else resolve response

      if 'XMLHttpRequest' of global # Always use JSONP in browser
        callback = "_jsonp_#{ id.replace /-/g, '' }"
        scripts = []

        request = =>
          scripts.push script = document.createElement 'script'
          script.defer = script.async = true;
          script.src = "#{href}#{query}&_token=#{@auth}&_callback=#{callback}&_=#{scripts.length}";
          sibling = document.getElementsByTagName('script')[0]
          sibling.parentNode.insertBefore script, sibling

        interval = setInterval ->
          if scripts.length < RETRIES then request() else
            for script in scripts
              try script.parentNode.removeChild script
            global[callback] = ->
            reject new TicketingHub.ConnectionError('Request timed out.')
        , TIMEOUT

        global[callback] = (body, status, headers) ->
          clearInterval interval
          global[callback] = ->
          for script in scripts
            try script.parentNode.removeChild script
          handle new Response status, body, headers

        request()
      else
        url = 'url'
        parts = require(url).parse href

        options =
          method: 'GET'
          scheme: parts.protocol[0...-1]
          host: parts.hostname
          port: parts.port
          auth: "#{@auth}:"
          path: "#{parts.path}#{query}"
          headers:
            accept: 'application/json'

        agent = require parts.protocol[0...-1]
        req = agent.request options, (res) ->
          data = ''
          res.on 'data', (chunk) -> data += chunk
          res.on 'end', ->
            return if res.statusCode == 0
            handle new Response res.statusCode, data, res.headers

        req.setTimeout TIMEOUT, ->
          reject new TicketingHub.ConnectionError('Request timed out.')

        req.on 'error', (error) ->
          reject new TicketingHub.ConnectionError(error.message)

        req.end()