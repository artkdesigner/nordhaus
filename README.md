# NORDHAUS — static mirror

This is a fully self-hosted static snapshot of [nordhaus-uprock.webflow.io](https://nordhaus-uprock.webflow.io), a scroll-driven "ride-over" narrative landing page for an architecture/real-estate studio.

Fetched: **2026-08-25**.

## What this is

- A one-to-one copy of the published Webflow page (HTML, CSS, fonts, images, videos, and all JS — Webflow's own compiled runtime plus a custom GSAP/ScrollTrigger scroll-narrative script) with every asset reference rewritten to point at local files under `assets/` instead of Webflow's CDN (`cdn.prod.website-files.com`) or the shared Webflow platform CDN (`d3e54v103j8qbb.cloudfront.net`).
- No dependency on Webflow hosting remains. The page also loads GSAP, ScrollTrigger, and Lenis (smooth scroll) from jsDelivr's public CDN, unchanged from the original.
- This is a **point-in-time snapshot**. It will not auto-sync with future edits made in the Webflow Designer — if the site changes in Webflow, this mirror needs to be re-generated to pick up the changes.

## Known limitation

There are no `<form>` elements on this page as of the fetch date, so there's no Webflow-form-submission caveat to flag here. (If a contact/newsletter form is added later in Webflow and this mirror is re-run, note for next time: Webflow's native form submission posts to Webflow's own backend, so a form ported into this static copy would render but not actually submit anywhere without a separate backend such as Formspree or a serverless function.)

## Structure

```
index.html
assets/
  css/    — the compiled Webflow stylesheet
  js/     — Webflow runtime chunks, jQuery, and the custom scroll-narrative script
  fonts/  — self-hosted webfonts (woff/otf)
  images/ — images, favicons, video poster frames
  video/  — background/section videos (mp4 + webm)
```

## Local preview

```
python3 -m http.server 8000
```
then open `http://localhost:8000/`.
