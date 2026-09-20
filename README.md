# Gloam browser camera

Static browser film lab and live camera prototype. Open `camera.html` over HTTPS, choose a film and grant camera permission. No server-side image uploads.

8 camera families and 31 presets; import photos, live preview, mirror, PNG capture. WebGL2 required. Browser stream resolution is not the native camera full resolution. Effects are reconstructed/approximated, not validated for pixel parity with the original app.

GitHub Pages source: main branch, repository root. `.nojekyll` preserves all static assets. `about.html` describes scope.

Synthetic camera checks: `studio/restoration/live-camera-check.html`. Actual phone capture requires device testing.
