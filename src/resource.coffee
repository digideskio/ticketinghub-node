{ merge, extend } = require('./util')
util = require('./util')
EventEmitter = require('events').EventEmitter
TicketingHub = require './ticketinghub'

class Resource extends EventEmitter
  module.exports = this

  Collection = require './collection'

  @load: (api, { id, path, singleton, fields, associations, collections, types }, endpoint, body) ->
    if type = types?[body.type]
      path = type.path if type.path
      associations = associations.concat type.associations || []
      collections = merge collections, type.collections || {}
      fields = merge fields, type.fields || {}

    path = if singleton then path else "#{ path }/#{ body[id || 'id'] }"
    new Resource(api, { fields, associations, collections }, endpoint.base(path), body)

  constructor: (@_api, @_schema, @_endpoint, attributes) ->
    super()

    { fields, associations, collections } = @_schema

    for association in associations || [] then do (association) =>
      this["#{association}="] = (attributes) ->
        this[association] = attributes && Resource.load(@_api, @_api.manifest.schema[association], @_endpoint, attributes)

    for key, resource of collections || {} then do (key, resource) =>
      this[key] = (args...) ->
        schema = @_api.manifest.schema[resource]
        if typeof args[0] is 'string'
          @_endpoint.get("#{schema.path}/#{args[0]}", args.slice(1)...).then (response) =>
            Resource.load @_api, schema, @_endpoint, response.body
        else new Collection @_api, schema, @_endpoint.join(key), args[0]

    @_setup attributes
    listening = false

    if @updated_at

      @on 'removeListener', (event) =>
        listening = false if EventEmitter.listenerCount(this, 'change') == 0

      @on 'newListener', (event) =>
        return if listening
        if event == 'change'
          listening = true
          updated_at = @updated_at

          retry = =>
            return unless listening
            @reload().then =>
              if updated_at != @updated_at
                updated_at = @updated_at
                @emit 'change', this
              setTimeout retry, util.timeDecay(@updated_at)
          setTimeout retry, util.timeDecay(@updated_at)

  delete: (params) ->
    @_endpoint.delete(params)
      .then (response) => @_setup(response.body)

  update: (attributes) ->
    @_endpoint.patch(attributes)
      .then (response) => @_setup(response.body)
      .catch (error) =>
        if (error instanceof TicketingHub.RequestError) && error.response.status == 422
          throw new TicketingHub.ValidationError @constructor.load(@_endpoint, error.response.body)
        else throw error

  reload: ->
    @_endpoint.get().then (response) =>
      @_setup response.body

  _setup: (params) ->
    for key, value of params
      if "#{key}=" of this
        @["#{key}="] value
      else @[key] = value
    return this