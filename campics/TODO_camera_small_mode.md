# TODO - Camera small mode (reduce camera screen height)

- Inspect current camera CSS sizing for `.video-wrap` / `#video` in `static/css/style.css`.
- Update CSS to reduce camera height on the home page / camera page (small screens):
  - Adjust `min-height` and/or add `max-height` for `.video-wrap`.
  - Prefer `clamp()` / `vh`-based sizing to avoid overflow with bottom nav.
  - Ensure `#video` matches container height.
- Add/adjust media queries for the relevant breakpoints (<=420px, <=360px).
- Run a quick static check by opening the pages and verifying layout.

