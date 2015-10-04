exports.parseISO8601DateTime = (s) ->
  re = /(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(\.\d+)?(Z|([+-])(\d\d):(\d\d))/
  d = s.match(re)  
  throw 'Couldn\'t parse ISO 8601 date string \'' + s + '\'' unless d
  a = [1, 2, 3, 4, 5, 6, 10, 11]
  for i of a
    d[a[i]] = parseInt(d[a[i]], 10)
  d[7] = parseFloat(d[7])
  ms = Date.UTC(d[1], d[2] - 1, d[3], d[4], d[5], d[6])
  if d[7] > 0
    ms += Math.round(d[7] * 1000)
  if d[8] != 'Z' and d[10]
    offset = d[10] * 60 * 60 * 1000
    if d[11]
      offset += d[11] * 60 * 1000
    if d[9] == '+'
      ms -= offset
    else
      ms += offset
  new Date(ms)

exports.extend = (a, b) ->
  for key, value of b
    a[key] = value
  return a

exports.merge = (a, b) ->
  value = exports.extend {}, a
  exports.extend value, b
  return value

exports.generateUUID = ->
  ([1e7]+-1e3+-4e3+-8e3+-1e11)
    .replace /[018]/g, (a) -> (a ^ Math.random() * 16 >> a / 4).toString(16)

exports.timeDecay = (date) =>
  date = exports.parseISO8601DateTime(date) if typeof date is 'string'
  seconds = (Number(new Date) - Number(date)) / 1000
  Math.log(1 + seconds, Math.E) * 1000