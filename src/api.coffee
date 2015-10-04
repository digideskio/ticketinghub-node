Endpoint = require './endpoint'
Resource = require './resource'

class API
  module.exports = this

  @load: (url, auth) ->
    new Endpoint(url).get().then (response) ->
      new API response.body, {
        ip: response.headers['x-client-ip'],
        country: response.headers['x-client-country']
        currency: response.headers['x-client-currency']
        language: response.headers['x-client-language']
      }, auth

  constructor: (@manifest, @client, @auth) ->
    for key, schema of @manifest.schema when schema.singleton then do (key, schema) =>
      this[key] = (params) ->
        (endpoint = new Endpoint(@manifest.origin, schema.path, @auth)).get().then ({ body }) =>
          Resource.load this, schema, endpoint, body