# Security

Do not publish exploitable vulnerabilities, secrets, personal data or raw request logs in public issues. Use GitHub's private vulnerability reporting if it has been enabled for this repository. Repository owners should enable that feature before public launch and provide an alternative private reporting channel if it is unavailable.

The initial release uses signed anonymous cookies, bounded JSON bodies, same-origin checks, parameterised SQL, transactional writes and keyed rate-limit buckets. These are not proof of verified humans or protection against all abuse. See the documented limitations before using leaderboard results externally.

Never deploy with the known local-development secret. The Worker refuses submissions without a configured secret of at least 32 characters. Keep Node's local development server off the public internet.
