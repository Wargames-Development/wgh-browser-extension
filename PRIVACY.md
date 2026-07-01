# Privacy Notes

This extension is intended to minimize data access.

For the Technic changelog workflow, the extension needs to:

- read a short-lived Wargames Solder extension job;
- open the user's Technic manage versions page;
- fill the version and changelog fields;
- ask for confirmation before submitting the normal form;
- report completion or failure back to Wargames Solder.

It does not collect Technic login credentials, cookies, session tokens, or 2FA material.

It does not send Technic cookies or page secrets back to Wargames.

The extension should keep host permissions narrow and limited to Wargames-controlled pages and the Technic manage versions page.

Short-lived Wargames extension job tokens should only be used for the specific workflow the user started. They should not be stored longer than needed for the active browser-assisted action.
