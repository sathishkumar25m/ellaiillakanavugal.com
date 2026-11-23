# Website reviews

The Reviews section loads and posts to `/api/reviews`. GitHub Pages serves the HTML and JavaScript. Run the review endpoint on a Cloudflare Worker with D1.

1. Apply `schema.sql` to the database and bind it to the Worker as `DB`.
2. Deploy `worker.mjs`. Set `REVIEW_SITE_ORIGINS` to the exact website origins, separated by commas. For this repository these are `https://ellaiillakanavugal.com,https://sathishkumar25m.github.io`.
3. In `index.html`, set the Reviews form's `data-review-api` to the public Worker URL ending in `/api/reviews` before deploying the site to GitHub Pages. Leave it empty when serving the website and endpoint together at the same directory root.
4. Test a review submission and reload Reviews to verify it remains listed. The WhatsApp link opens a prefilled message for the site's WhatsApp contact.

Only the name, rating, and comment appear in the Reviews section. The form requires consent to publish all three.
