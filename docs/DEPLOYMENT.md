# Deployment

The app is a static bundle with no runtime dependencies and no environment variables. Deploy it like any static site — but note the required security headers and the review gates at the bottom.

## 1. Build

```bash
cd health-os
npm ci
npm run build        # typecheck + vite build → dist/
npm run preview      # sanity-check the production bundle locally
```

`dist/` contains `index.html`, one CSS file and one JS bundle. Nothing else is needed.

## 2. Static hosting (recommended for MVP)

Any static host works (Netlify, Vercel, Cloudflare Pages, S3+CloudFront, GitHub Pages, an internal nginx). Two requirements:

1. **SPA fallback:** rewrite unknown paths to `/index.html`.
2. **HTTPS only**, with HSTS.

### nginx example

```nginx
server {
  listen 443 ssl http2;
  server_name health.example.com;

  root /var/www/health-os/dist;
  index index.html;

  # Never cache the HTML shell; cache hashed assets aggressively.
  location = /index.html { add_header Cache-Control "no-store"; }
  location /assets/     { add_header Cache-Control "public, max-age=31536000, immutable"; }

  location / { try_files $uri $uri/ /index.html; }

  # ── Required security headers ──────────────────────────────────────────────
  add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "no-referrer" always;
  add_header X-Frame-Options "DENY" always;
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()" always;
  # No third-party origins are needed. 'wasm-unsafe-eval' is not required.
  add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" always;
}
```

`Referrer-Policy: no-referrer` matters more than usual here: a share link in a URL fragment should never leak through a `Referer` header. The share token is placed in the URL fragment (`#e=…`), which browsers never transmit — keep it that way.

## 3. Container

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf   # headers from §2
EXPOSE 80
```

```bash
docker build -t personal-health-os .
docker run -p 8080:80 personal-health-os
```

No secrets, volumes or database are required. If you add the deferred sync backend, run it as a **separate** service with its own review.

## 4. Platform notes

- **iOS/Android PWA:** installable via Add to Home Screen; `viewport-fit=cover` and safe-area padding are already set. True lock-screen widgets and emergency-calling integration are native features that need platform review (see the README's review list).
- **Passkeys:** require a secure context (HTTPS or localhost) and an authenticator supporting the WebAuthn **PRF** extension. The UI hides the option when unsupported, so no configuration is needed.
- **Print:** the emergency card has a dedicated print stylesheet (`.no-print` chrome, black-on-white). Print to PDF from Emergency Mode for a paper card.

## 5. Release checklist

- [ ] `npm test` green (70 tests) and `npm run typecheck` clean
- [ ] `npm run build` succeeds; bundle inspected for accidental secrets
- [ ] Security headers above applied and verified (e.g. securityheaders.com)
- [ ] HTTPS enforced; HSTS enabled
- [ ] Automated accessibility scan (axe/Lighthouse) passes at AA; manual screen-reader pass on Emergency Mode
- [ ] Manual pass: emergency card prints legibly in black and white
- [ ] Manual pass: Emergency Mode reachable in ≤2 taps from cold start when consented
- [ ] Manual pass: lock-screen access disabled → cached preview deleted (check IndexedDB `meta.locked-emergency` is absent)
- [ ] Manual pass: caregiver invite → accept → scoped view → revoke
- [ ] Export produces a readable archive; account deletion removes `kv` and `meta` stores
- [ ] Independent security review / penetration test completed
- [ ] Legal review of consent, caregiver and emergency-sharing copy
- [ ] Clinical review of any medication or reminder wording
- [ ] Browser E2E specs executed (`npx playwright install && npm run test:e2e`)
- [ ] Support/incident runbook agreed (see `docs/SECURITY.md` §6)

## 6. Do not deploy until

The items in **"Requires review before real-world deployment"** in [../README.md](../README.md) are closed. In particular, do not present this app as compliant with HIPAA, GDPR, PIPEDA or as a medical device, and do not enable any cloud sync until the end-to-end encryption protocol has been independently reviewed.