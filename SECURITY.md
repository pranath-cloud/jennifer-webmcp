# Security Policy

## Supported Versions

| Branch | Supported |
| ------ | --------- |
| main   | Yes       |

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

Please report privately via GitHub's private vulnerability reporting
(Security → Report a vulnerability) or contact the repository owner directly.

Include:

- Description of the vulnerability and its potential impact
- Steps to reproduce or a proof of concept
- Affected endpoint or component (`app/api/*`, `lib/webmcp/*`, etc.)

You can expect an acknowledgement within 48 hours.

## Secrets & Credentials Policy

- Never commit credentials, Shopify access tokens, `.env` files, or key
  material. All secrets belong in environment variables.
- If a secret is accidentally committed, treat it as compromised: rotate it
  immediately, then remove it from the codebase.
