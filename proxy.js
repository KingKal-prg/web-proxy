const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { Buffer } = require('buffer');

const app = express();

app.use('/proxy', (req, res, next) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('Missing url param');

  const proxy = createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    selfHandleResponse: true, // so we can modify response
    onProxyRes: async (proxyRes, req, res) => {
      let body = Buffer.from([]);
      proxyRes.on('data', chunk => body = Buffer.concat([body, chunk]));
      proxyRes.on('end', () => {
        const contentType = proxyRes.headers['content-type'] || '';
        let responseBody = body.toString('utf8');

        if (contentType.includes('text/html')) {
          // Rewrite URLs in HTML here:
          // For example, replace all href="https://www.youtube.com" 
          // with href="/proxy?url=https%3A%2F%2Fwww.youtube.com"
          responseBody = responseBody.replace(/href="(https?:\/\/[^"]+)"/g, (match, url) => {
            const proxiedUrl = `/proxy?url=${encodeURIComponent(url)}`;
            return `href="${proxiedUrl}"`;
          });
          // Similarly for src, action, etc.
        }

        // Remove iframe-blocking headers:
        delete proxyRes.headers['x-frame-options'];
        delete proxyRes.headers['content-security-policy'];

        // Set headers for the proxied response
        Object.entries(proxyRes.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });

        res.status(proxyRes.statusCode).send(responseBody);
      });
    }
  });
  proxy(req, res, next);
});

app.listen(3000, () => console.log('Proxy running on http://localhost:3000'));
