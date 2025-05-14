const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

app.use('/proxy', (req, res, next) => {
  const target = req.query.url;
  if (!target) return res.status(400).send('No URL provided');
  createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: () => '',
    onError: (err, req, res) => {
      res.status(500).send('Proxy error');
    }
  })(req, res, next);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
