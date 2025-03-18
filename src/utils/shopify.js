import Client from 'shopify-buy';

const client = Client.buildClient({
  domain: 'ug690t-99.myshopify.com',
  storefrontAccessToken: 'a1cdc2f51fb8f0c9f43a8a828a22481c',
  apiVersion: '2024-01'
});

// Test the connection
client.shop.fetchInfo().then((shop) => {
  console.log('Connected to shop:', shop.name);
}).catch((err) => {
  console.error('Connection error:', err);
});

export default client; 