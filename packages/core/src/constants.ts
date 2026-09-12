/**
 * Centralized magic numbers — dev server, cert handling, and fallback origins.
 * Keep `paths: {}` empty and use `.js` extensions when importing from other packages.
 */

export const DEFAULT_DEV_PORT = 4321;

export const CERT_VERIFY_TIMEOUT = 3000;

export const CERT_INSTALL_TIMEOUT = 15000;

export const NSSDB_TIMEOUT = 10000;

export const LOCALHOST_FALLBACK_ORIGIN = "http://localhost:4321";

export const LOCALHOST_PREVIEW_FALLBACK_ORIGIN = "http://localhost:3000";

export const DEV_SERVER_HTTPS_ORIGIN = `https://localhost:${DEFAULT_DEV_PORT}`;

export const DEV_SERVER_HTTP_ORIGIN = `http://localhost:${DEFAULT_DEV_PORT}`;

export const CERT_CORS_DETAIL = `Browsers will block ${DEV_SERVER_HTTPS_ORIGIN} until it is trusted (CORS / NET::ERR_CERT_AUTHORITY_INVALID)`;
