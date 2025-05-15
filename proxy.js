const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const app = express();

const PORT = process.env.PORT || 3000;

// Helper function to rewrite URLs inside HTML
function rewriteHtml(html, baseProxyUrl) {
  const $ = cheerio.load(html);

  // Rewrite href links
  $('a[href]').each((i, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    // Ignore anchors, javascript links, mailto
    if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) return;

    // Rewrite absolute or relative URLs to route via proxy
    let newUrl;
    if (href.startsWith('http')) {
      newUrl = `${baseProxyUrl}?url=${encodeURIComponent(href)}`;
    } else if (href.startsWith('/')) {
      // Relative to domain root
      // Extract domain from baseProxyUrl param to build full URL
      const baseUrl = new URL(baseProxyUrl);
      newUrl = `${baseProxyUrl}?url=${encodeURIComponent(baseUrl.origin + href)}`;
    } else {
      // Relative URL (e.g. ./page.html)
      newUrl = `${baseProxyUrl}?url=${encodeURIComponent(href)}`;
    }
    $(el).attr('href', newUrl);
  });

  // Rewrite src attributes (images, scripts, etc.) similarly if needed
  // For many sites you can skip this or selectively rewrite resources

  return $.html();
}

app.get('/', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    // Show basic HTML search form if no url param
    res.send(`
      <form method="get" action="/">
        <input name="url" placeholder="Enter a URL (e.g. youtube.com)" style="width: 300px" />
        <button type="submit">Go</button>
      </form>
    `);
    return;
  }

  try {
    // Add http:// if missing for fetch to work
    let fetchUrl = targetUrl;
    if (!/^https?:\/\//i.test(fetchUrl)) {
      fetchUrl = 'http://' + fetchUrl;
    }

    const response = await fetch(fetchUrl);
    const contentType = response.headers.get('content-type');

    let body = await response.text();

    if (contentType && contentType.includes('text/html')) {
      // Rewrite HTML links to route via proxy
      const baseProxyUrl = `${req.protocol}://${req.get('host')}${req.path}`;
      body = rewriteHtml(body, baseProxyUrl);
    }

    // Remove frame blocking headers if any
    res.set('X-Frame-Options', 'ALLOWALL');
    res.set('Content-Security-Policy', "frame-ancestors *");

    // Forward other headers you want or set your own
    res.set('Content-Type', contentType);

    res.send(body);
  } catch (err) {
    res.status(500).send('Error fetching the page.');
    console.error(err);
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server listening at http://localhost:${PORT}`);
});
