# Security Policy

## Supported Security Model

WGH Browser Extension is designed to assist user-initiated browser workflows only.

The extension must not collect or store:

- Technic passwords;
- Technic usernames for authentication;
- Technic cookies;
- Technic session tokens;
- 2FA material;
- Wargames internal API tokens.

The extension may temporarily hold a short-lived Wargames Solder extension job token in memory while the user completes the action. That token is scoped to one job and expires quickly.

## Reporting Security Issues

Please report security issues privately.

Contact:

- abuse@wargames.uk

Do not post exploitable details, private tokens, session data, screenshots containing sensitive account information, or proof-of-concept abuse steps in public GitHub Issues.

A public issue may be opened after the issue has been fixed or after the maintainers confirm that public disclosure is appropriate.

## Public Issues

GitHub Issues may be used for normal bugs, browser compatibility reports, feature requests, and documentation problems.

Security reports should not use public issues.

## Audit Posture

The extension source is intended to be reviewable. Sensitive business logic and private integrations should remain on the Wargames backend, not in the extension.
