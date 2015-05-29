extend = require('./util').extend
Promise = require('es6-promise').Promise;
Response = require './response'

util = require './util'

class Endpoint

  TIMEOUT = 30 * 1000
  RETRIES = 3

  constructor: (@origin, @path = '', @auth = '') ->
    @url = "#{@origin}#{@path}"

  base: (path, auth = @auth) ->
    new Endpoint @origin, path, auth

  join: (path, auth = @auth) ->
    new Endpoint @origin, "#{@path}/#{path}", auth

  for method in ['get', 'post', 'patch', 'delete'] then do (method) =>
    @::[method] = (path, params) ->
      [path, params] = [params, path] unless typeof path == 'string'
      @request method, path, params

  request: (method, path = '', params) ->
    id = util.generateUUID()

    new Promise (resolve, reject) =>
      parts = util.parseURL "#{@url}/#{path}"
      json_params = encodeURIComponent JSON.stringify(params || {})
      query = "?_id=#{id}&_json=#{json_params}&_method=#{method.toLowerCase()}"

      handle = (response) ->
        if 400 <= response.status < 500
          reject new TicketingHub.RequestError(response)
        else if 500 <= response.status < 600
          reject new TicketingHub.ServerError(response)
        else resolve response

      if 'XMLHttpRequest' of global
        xhr = new XMLHttpRequest

        if 'withCredentials' of xhr && 'timeout' of xhr
          # CORS
          xhr.timeout = TIMEOUT
          xhr.withCredentials = true
          xhr.open 'GET', "#{parts.href}#{query}", true, @auth
          xhr.onload = ->
            body = xhr.responseText
            headers = util.parseResponseHeaders xhr.getAllResponseHeaders()
            handle new Response xhr.status, body, headers

          xhr.onerror = ->
            reject new TicketingHub.ConnectionError('Request network error.')

          xhr.ontimeout = ->
            reject new TicketingHub.ConnectionError('Request timed out.')

          xhr.send();

        else
          # JSONP fallback
          global._th_jsonp_counter ||= 0

          callback = "_th_jsonp_callback#{id = global._th_jsonp_counter++}"
          script = document.createElement 'script'
          script.type = 'text/javascript';
          script.async = true;
          script.src = "#{parts.href}#{query}&_token=#{@auth}&_callback=#{callback}&_=#{Number(new Date) + ".#{id}"}";

          timeout = setTimeout ->
            script.parentNode.removeChild script
            global[callback] = ->
            reject new TicketingHub.ConnectionError('Request timed out.')
          , TIMEOUT

          global[callback] = (body, status, headers) ->
            clearTimeout timeout
            global[callback] = ->
            script.parentNode.removeChild script
            handle new Response status, body, headers

          target = document.getElementsByTagName('script')[0] || document.head
          target.parentNode.insertBefore(script, target);
      else

        options =
          method: 'GET'
          scheme: parts.protocol[0...-1]
          host: parts.hostname
          port: parts.port
          auth: "#{@auth}:"
          path: "#{parts.path}#{query}"

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

module.exports = Endpoint