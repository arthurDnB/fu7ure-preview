# FU7URE storefront prototype

Run `node build-products.mjs` and `node serve.mjs` from this directory. The server prints the local URL and supports the byte-range requests used by video scrubbing.

The catalog has 54 preview products across six collections. Existing product entries live in `index.html`. Sample specifications and the concept-product additions live in `catalog-content.js`. Run `node build-products.mjs --check` before publishing to check the generated product pages and sitemap. Set `FU7URE_SITE_URL` to the public site root when generating metadata for another host.

To walk through checkout, add an item by size, open Demo checkout, and select **Use sample details**. Australia and New Zealand have standard and express test rates. Completion saves a demo order reference and total in the browser. Customer care opens the demo order history and support walkthrough. The waitlist stores a local signup status.

All items, specifications, prices, stock, delivery rates and orders are for the prototype. A commercial launch needs final product information, a commerce host, real fulfillment and payments, and connected email and support services.

## Replace the Show motion studies

1. Add the final, widened 16:9 H.264 MP4 files to `media/`. Keep the first pair’s opening visible, start clips two and three behind the pillar, end clips one and two behind it, and end clip three on the clear closing pose. Exports with frequent keyframes offer smoother seeking in both directions.
2. Set the matching values in `media-config.js` to the relative file paths. Example: `"r2-sasha": "media/r2-sasha.mp4"`.
3. Refresh the page. Each available clip takes over its chapter independently. The still sequence covers missing or unsupported video. Motion-off mode shows the wardrobe stills.

The three prototype clips are motion studies made from the authored reference artwork. The chapter buttons jump between pairs of styles. The floating labels follow the cast and open the matching collection.
