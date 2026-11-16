# A9 — Phase A hosting assessment on the RAWASY Namecheap account (in progress)

**Brief:** "RAWASY METAL WEBSITE — AUTHORIZE NAMECHEAP PHASE A". The Owner accepts the F-1 correction for
staging-readiness purposes, and authorizes **phase A, read-only hosting verification**, using the existing
`docs/admin/A9-STAGING-PACKAGE.md` §1A.

**Not authorized, and not done:**
- hosting changes;
- creating an application or database;
- DNS, SSL or security configuration changes;
- a staging or production deployment;
- sharing credentials or private keys;
- a merge into `main`;
- phase B without the Owner's separate written authorization.

`staging.rawasymetal.com` is the proposed staging host, for planning only; creating its DNS record is not authorized.

This file is the evidence log the package's §1A ends with ("After phase A"). It is updated as each set of evidence
arrives, and it becomes the phase A report when the assessment is complete. It holds no credential, and evidence is
recorded here only after redaction.

## Status

| | |
|---|---|
| Evidence received | A14 (the engineer's public check, run from this session) |
| Waiting for | A1–A13 from the Owner |
| H1–H14 | 0 PASS · 0 FAIL · 14 UNVERIFIED |
| Findings so far | the live domain's HTTPS certificate does not name it (P-1); the facts P-2 to P-4 |

## Evidence log

### A14 — public DNS and HTTP answers *(engineer, 2026-11-16 23:46 UTC)*

**How it was run.** This session has no `dig`, and its network proxy allows only the hosts its cloud environment
lists. The Owner approved adding `rawasymetal.com`, `www.rawasymetal.com`, `staging.rawasymetal.com` and `dns.google`
to that list. That is a change to this session's own environment, not to the hosting account. Then:
- **DNS:** Google's public DNS-over-HTTPS resolver (`https://dns.google/resolve?name=…&type=…`), which gives the same
  answers as `dig +short`.
- **HTTPS:** `curl -sI`, then `openssl s_client` to read the certificate and the headers.
- **HTTP:** through the proxy's tunnel (`curl -p`).

Every request was a lookup, a HEAD or one GET of the home page. Nothing was sent but the request line.

**DNS records:**

| Record | Answer |
|---|---|
| NS `rawasymetal.com` | `dns1.namecheaphosting.com.`, `dns2.namecheaphosting.com.` |
| SOA | `dns1.namecheaphosting.com. cpanel.tech.namecheap.com.`, serial `1762951850` (2025-11-12 12:50:50 UTC) |
| A `rawasymetal.com` | `66.29.146.24` |
| AAAA `rawasymetal.com` | none |
| CNAME `www.rawasymetal.com` | `rawasymetal.com.` |
| MX | `5 mx1-hosting.jellyfish.systems.`, `10 mx2-…`, `20 mx3-…` |
| TXT (SPF) | `v=spf1 +a +mx +ip4:66.29.146.23 +ip4:66.29.146.28 include:spf.web-hosting.com ~all` |
| TXT `_dmarc` | `v=DMARC1; p=none;` |
| CAA | none (no restriction on which authority may issue a certificate) |
| A / CNAME `staging.rawasymetal.com` | **NXDOMAIN** (does not exist) |

**HTTP and HTTPS answers:**

| Request | Answer |
|---|---|
| `http://rawasymetal.com/`, `http://www.rawasymetal.com/` | `301` to the same address on `https://`; `Server: envoy`, `X-Turbo-Charged-By: LiteSpeed` |
| `https://rawasymetal.com/`, `https://www.rawasymetal.com/` | `200`, `server: LiteSpeed`, `content-type: text/html`, 11,219 bytes, `last-modified: Wed, 12 Nov 2025 13:33:39 GMT` |
| The certificate presented to both names | `CN=*.web-hosting.com`, SAN `*.web-hosting.com, web-hosting.com`; issuer SSL.com TLS Issuing RSA CA R1; valid 2026-11-03 → 2027-05-20; the chain verifies to a trusted root, **but the certificate does not name `rawasymetal.com` or `www.rawasymetal.com`** (`curl`: "no alternative certificate subject name matches target host name") |
| `https://staging.rawasymetal.com/` | no answer (the name does not exist) |
| The home page | title "Rawasy Metal"; a static export of an earlier Next.js website (route group `(main)`, `/_next/static/chunks/…`), not this repository's release (route group `(commerce)`) |

**Read against the package.** A14's rule is "today's records captured; `staging.rawasymetal.com` resolves to nothing
yet": **met.**

## Findings

- **P-1 — the live website's HTTPS certificate does not cover the domain.**
  - The server answers `https://rawasymetal.com` and `https://www.rawasymetal.com` with its own shared certificate
    (`*.web-hosting.com`). Port 80 sends every visitor there (301).
  - A browser will most likely show a certificate warning instead of the page. Confirm this in a normal browser.
  - This is the production website as it is today. Nothing in this project caused it, and nothing was changed.
  - The usual cause is that cPanel's AutoSSL has not issued a certificate for the domain; A10 (SSL/TLS Status) shows the
    reason.
  - Fixing it (running AutoSSL, or installing a certificate) is an SSL change on production. It is the Owner's decision,
    and outside phase A.
  - **For staging it is a risk to H14:** the staging admin needs a valid certificate for `staging.rawasymetal.com`
    (its session cookie is `__Host-` and `Secure`). If AutoSSL is failing for the account, it may fail there too.
- **P-2 — the domain's DNS is served by the hosting account.** Its nameservers are `dns1` / `dns2.namecheaphosting.com`,
  so the zone is edited in cPanel (Zone Editor / Domains), not in Namecheap's Advanced DNS. Creating
  `staging.rawasymetal.com` in cPanel → Domains would therefore add its DNS record at once: a DNS change, which waits for
  the Owner's authorization (D2, D8). A12 and A13 confirm this.
- **P-3 — mail runs on the hosting account** (MX `jellyfish.systems`, SPF with `include:spf.web-hosting.com`, DMARC
  `p=none`). Staging changes none of it (SMTP stays off).
- **P-4 — the edge in front of LiteSpeed.** Port 80 answers through `envoy` before LiteSpeed; port 443 showed LiteSpeed's
  headers only.
  - The staging access control by IP allowlist in `.htaccess` (H14.2) and `TRUSTED_PROXY_HOPS` (H14.3) both depend on
    which address LiteSpeed and the app see. The package already marks both "to be verified" in phase B; this edge
    makes that verification essential.
  - Basic authentication is the fallback the package names.

## H1–H14

| Check | Phase A steps | Evidence so far | Status |
|---|---|---|---|
| H1 Node.js 22, Passenger | A1, A4, A6 | — | UNVERIFIED |
| H2 glibc for sharp | A4 | — | UNVERIFIED |
| H3 Terminal, SSH, forwarding | A4, A11 | — | UNVERIFIED |
| H4 MariaDB | A1, A5 | — | UNVERIFIED |
| H5 Connection budget | A5 | — | UNVERIFIED |
| H6 Processes | A2, A4, A6 | — | UNVERIFIED |
| H7 Memory, CPU, entry processes | A2 | — | UNVERIFIED |
| H8 Response times | — (phase B) | — | UNVERIFIED |
| H9 Data folder, quota, inodes | A3, A4 | — | UNVERIFIED |
| H10 ModSecurity, uploads | A7 | — | UNVERIFIED |
| H11 Cron | A8 | — | UNVERIFIED |
| H12 Backups, keys | A9 | — | UNVERIFIED |
| H13 Staging DNS | A12, A13, A14 | A14: today's records captured; `staging.` does not exist; DNS on the hosting nameservers (P-2) | UNVERIFIED (A12, A13 to come; phase B needs the DNS authorization) |
| H14 HTTPS, access, proxy | A1, A10 | LiteSpeed named in the live headers; the live domain's certificate does not match it (P-1); an `envoy` edge on port 80 (P-4) | UNVERIFIED (A10 to come); **at risk** (P-1) |

## Rounds

| Round | Steps | Evidence | Status |
|---|---|---|---|
| 0 | A14 (engineer) | this session | done |
| 1 | A1, A2, A3 (panels) | screenshots | waiting |
| 2 | A4 (Terminal), A5 (phpMyAdmin) | pasted text | waiting |
| 3 | A6–A13 (panels) | screenshots | waiting |

Phase B (the steps of §1 marked *writes*, then §4–§12) starts only with the Owner's separate written authorization (D8).
