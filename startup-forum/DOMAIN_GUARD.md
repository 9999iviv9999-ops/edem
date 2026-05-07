# Domain Guard: STARTFLOW Forum

This forum is isolated from other repository products and uses its own namespace.

## Existing project domains (must not be reused)

- `edem.press`
- `api.edem.press`
- `vprok.club`
- `api.vprok.club`
- `skinulis-api.vercel.app`
- `nft-web-roan.vercel.app`
- `edem-web.vercel.app`

## Reserved namespace for this forum

- Product namespace: `startflow-forum`
- Suggested production domain: `startflowforum.com`
- Suggested API subdomain: `api.startflowforum.com`
- Suggested preview domain pattern: `preview.startflowforum.com`

## Isolation rules

1. Do not use `edem`, `vprok`, `skinulis`, `geneso`, `nft-web` in hostnames or deployment project names.
2. Use a dedicated port for local run: `4211`.
3. Keep this project under `startup-forum/` only, without imports from sibling apps.
4. Keep env keys prefixed with `STARTUP_FORUM_` if new config is added later.
