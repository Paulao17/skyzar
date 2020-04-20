module.exports = {
  apiKey: process.env.KEY ? process.env.KEY : '', // Required for the update process
  redis: {
    port: process.env.REDISPORT ? process.env.REDISPORT : 6379, // Redis port
    host: process.env.REDISHOST ? process.env.REDISHOST : '127.0.0.1', // Redis host
    family: 4, // 4 (IPv4) or 6 (IPv6)
    password: process.env.REDISPASSWORD ? process.env.REDISPASSWORD : '', // Redis AUTH password. None if unchanged
    db: 0,
  },
  timeBetweenCycles: 1000 // The amount of time between query cycles, in milliseconds
}
