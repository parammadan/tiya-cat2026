# Deployment

## GitHub Pages (primary)

- **Repository:** `parammadan/tiya-cat2026` (public)
- **Site:** `https://parammadan.github.io/tiya-cat2026/`

### How it deploys

The workflow `.github/workflows/deploy.yml` runs on every push to `main`. It can also be started by hand from the **Actions** tab.

| Step | Command |
|---|---|
| Install | `npm ci` |
| Import the mocks from `content/mockN/*.md` | `npm run import` |
| Validate all 120 questions, keys and explanations | `npm run validate` (fails the deploy on any error) |
| Run the automated tests | `npm test` (Vitest) |
| Type-check and build `dist/` | Vite base path `/tiya-cat2026/` |
| Publish | official `actions/upload-pages-artifact` and `actions/deploy-pages` |

The app uses hash routes (`#/exam/...`), so refreshing any page and using browser back/forward work without server rewrites.

### Updating the site later

1. **Edit the files.**
   - **Content:** edit `content/mockN/MockN_QuestionPaper.md` or `MockN_Solutions.md`. These are byte-identical copies of the originals in `~/Desktop/CAT2026-VARC/mockN/`; keep the two in step.
   - **App:** edit files under `src/`.
2. **Check locally.**
   ```bash
   npm run build && npm test
   npm run e2e    # optional: browser checks at 1366×768 against a local preview
   ```
3. **Commit and push to `main`.** GitHub redeploys in about 1–2 minutes. Progress shows in the repository's **Actions** tab.
4. **Optional: check the live site.**
   ```bash
   E2E_URL=https://parammadan.github.io/tiya-cat2026/ npm run e2e
   ```

### Privacy

The repository is public, because GitHub Pages requires that on a free plan. The source code, Tiya's name, every question and every answer key can therefore be read by anyone who finds the repository or the site.

`noindex` is set in the page, which asks search engines not to list the site. This is a request, not access control.

Attempt history is stored only in the browser on the device Tiya uses. Nothing is uploaded, and history does not sync between devices. Use **Performance → Export / Import** to move it.

## Cloudflare Pages (alternative)

`npm run build` and upload the contents of `dist/` through **Workers & Pages → Create → Pages → Upload assets**.

The production base path is `/tiya-cat2026/`. For a site served from a domain root, change `base` in `vite.config.ts` to `/` (or `./`) before building.
