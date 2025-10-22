import httpProxy from 'http-proxy-middleware';
import express from 'express';

const app = express();
const proxy = httpProxy.createProxyMiddleware({
  target: 'http://127.0.0.1:8080',
  changeOrigin: true
});

app.use('/', proxy);

app.listen(80, () => {
  console.log('Proxy running on port 80 → forwarding to 8080');
});