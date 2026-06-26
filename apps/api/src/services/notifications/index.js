const email = require('./email.channel');
const zalo = require('./zalo.channel');

// Pluggable channel registry — add a new channel by adding one entry here.
module.exports = { email, zalo };
