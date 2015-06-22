module.exports = require('./ticketinghub')
if typeof global.window isnt 'undefined'
  global.window.TicketingHub = module.exports