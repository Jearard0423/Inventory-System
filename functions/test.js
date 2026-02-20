const { buildOrderEmail } = require('./index.js')

// Sample order for local testing
const sampleOrder = {
  id: 'ord-123',
  customerName: 'Juan Dela Cruz',
  date: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
  items: [
    { id: 'i1', name: 'Chicken Roast', price: 250, quantity: 2 },
    { id: 'i2', name: 'Rice', price: 30, quantity: 2 }
  ],
  total: 560
}

const logo = process.env.BUSINESS_LOGO_URL || 'https://example.com/logo.png'

console.log('Building sample email HTML...')
const html = buildOrderEmail(sampleOrder, logo)
console.log('--- EMAIL HTML START ---')
console.log(html)
console.log('--- EMAIL HTML END ---')

console.log('Test complete.')
