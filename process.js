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

config = require('./config')

let redis = new Redis(config.redis);

// Queries the Hypixel API to get the latest data regarding the
let getProducts = () => new Promise((resolve, reject) => {
  const req = https.get(`https://api.hypixel.net/skyblock/bazaar?key=${config.apiKey}`, res => {
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
async function updateProduct(product, time) {
  product.quick_status.time = time
  product.quick_status.flipProfit = product.quick_status.buyPrice - product.quick_status.sellPrice
  await redis.hset('prod' + product.product_id, product.quick_status)

  // TODO calc profit
  // TODO Add to history
  // TODO PUB/SUB
  // TODO Volumes
  // TODO Rebuild full data
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
  await getProducts().then((data) => { // Fetch the data from the Hypixel API
    Object.values(data.products).forEach((product) => updateProduct(product, data.lastUpdated)) // Update each product data
  }).catch(console.log) // TODO change catch response

  console.log(new Date() + ` Queried the API. Next cycle in ${config.timeBetweenCycles} ms.`)
}

async function loop() {
  if (await redis.get('stop') === "true") {
    console.log('Stopping (as requested in db)')
    await redis.disconnect()
    return process.exit()
  }
  await runCycle()
  await waitMs(config.timeBetweenCycles)
  loop()
}

loop()
//getProduct('COBBLESTONE').then(updateProduct).catch(console.log)
