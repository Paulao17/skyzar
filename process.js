/**
Process updating data in the redis database for the Skyzar service.

Subject to the MIT license below

Copyright 2020 Paulao17

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/
const https = require('https')
var Redis = require('ioredis')

const apiKey = process.env.KEY ? process.env.KEY : '';
const redisConfig = {
  port: process.env.REDISPORT ? process.env.REDISPORT : 6379, // Redis port
  host: process.env.REDISHOST ? process.env.REDISHOST : '127.0.0.1', // Redis host
  family: 4, // 4 (IPv4) or 6 (IPv6)
  password: process.env.REDISPASSWORD ? process.env.REDISPASSWORD : '',
  db: 0,
}
const timeBetweenCycles = 1000 // The amount of time between query cycles, in milliseconds

let redis = new Redis(redisConfig);

// Queries the Hypixel API to get the latest data regarding the
let getProduct = (product) => new Promise((resolve, reject) => {
  const req = https.get(`https://api.hypixel.net/skyblock/bazaar/product?productId=${product}&key=${apiKey}`, res => {
    if (res.statusCode != 200) console.log(`statusCode: ${res.statusCode}`)

    res.setEncoding('utf8')
    rawData = ''
    res.on('data', (chunk) => {
      rawData += chunk
    });
    res.on('end', () => {
      try {
        parsedData = JSON.parse(rawData)
        if (parsedData.success) resolve(parsedData)
        else reject(parsedData.cause)
      } catch (e) {
        reject('Failed to parse JSON')
      }
    })
  })

  req.on('error', reject)

  req.end()
  redis.incr('requests') // To tally the total number of requests
})

// Update product status in the db
async function updateProduct(data) {
  data.product_info.quick_status.time = Date.now()
  await redis.hset('prod' + data.product_info.product_id, data.product_info.quick_status)

  // TODO calc profit
  // TODO Add to history
  // TODO PUB/SUB
  // TODO Volumes
}

// Returns a promise resolving in x milliseconds
function waitMs(x) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, x);
  });
}

async function runCycle() {
  current = await redis.lpop('products').catch() // Fetch the id of the next item to query.
  if (!current) { // In case no items are to be queried (as set in db)
    console.log(current)
    console.log('We did not find any items to query, stopping.')
    await redis.disconnect()
    return process.exit()
  }
  await getProduct(current).then(updateProduct).catch(console.log) // TODO change catch response
  await redis.rpush('products', current)
  console.log(new Date() + ` Queried the API for ${current}. Next cycle in ${timeBetweenCycles} ms.`)
}

async function loop() {
  if (await redis.get('stop') === "true") {
    console.log('Stopping (as requested in db)')
    await redis.disconnect()
    return process.exit()
  }
  await runCycle()
  await waitMs(timeBetweenCycles)
  loop()
}

loop()
//getProduct('COBBLESTONE').then(updateProduct).catch(console.log)
