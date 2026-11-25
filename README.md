# FU7URE storefront prototype

Run `node build-products.mjs` and `node serve.mjs` from this directory. The server prints the local URL and supports the byte-range requests used by video scrubbing.

The catalog has 54 preview products across six collections. Existing product entries live in `index.html`. Sample specifications and the concept-product additions live in `catalog-content.js`. Run `node build-products.mjs --check` before publishing to check the generated product pages and sitemap. Set `FU7URE_SITE_URL` to the public site root when generating metadata for another host.

To walk through checkout, add an item by size, open Demo checkout, and select **Use sample details**. Australia and New Zealand have standard and express test rates. Completion saves a demo order reference and total in the browser. Customer care opens the demo order history and support walkthrough. The waitlist stores a local signup status.

All items, specifications, prices, stock, delivery rates and orders are for the prototype. A commercial launch needs final product information, a commerce host, real fulfillment and payments, and connected email and support services.

## The Show

One sticky full-screen stage plays three live-action clips, one per duet, scrubbed frame by frame by the scroll. The camera follows the scroll on a spring, so it speeds up and then settles. A steel pillar crosses right to left between duets and stays fully closed while the clip changes. Each duet's style labels show only on its front view and hide while the pillar crosses.

- Clips are set in `media-config.js`: the "720p max" renders (7-10 MB each). They must be 16:9 H.264 MP4 with a keyframe on every frame (`-g 1`) so they seek smoothly both ways. Lighter versions of the same takes are listed there as a comment, to swap in if phones struggle.
- **R2 and Sasha never go in this folder or in git.** Sasha's face is based on a real person, so clip 01, its poster (frame 0, used under the clip while it downloads) and the still-version photo all load from their Higgsfield URLs. The poster is the article's `data-poster` in `index.html`.
- Clips 02 and 03 live in `media/show/`. Their start and end frames (`media/*-720max-*.webp`) sit under the video; the still version uses those frames, plus Higgsfield's photo with QU4NT's episode face for duet 2.
- Timing, label windows and the dancers' chest positions are in `sceneDesigns` in `site.js`. If a clip is replaced, re-read the positions from the new footage.
- Scroll per duet is `--step` in `styles.css`. Try other values on a preview with `?step=70` (screen heights × 100).
- Phones get the animation too, cropped to the middle of the widescreen footage. The still version is used with reduced motion, data saver and very short screens (phones held sideways). The Motion button switches it by hand.
