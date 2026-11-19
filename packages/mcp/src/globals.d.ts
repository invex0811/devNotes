// Values that the release build (build.mjs release) puts into the bundle. They are
// absent from the sources and from development builds, so code must check
// `typeof` before using them.

/** Client ID of the site's "Desktop app" OAuth client. */
declare const __DEVNOTES_CLIENT_ID__: string | undefined
/** Its client secret; Google does not treat it as confidential for desktop apps. */
declare const __DEVNOTES_CLIENT_SECRET__: string | undefined
/** Where the launcher downloads the current server bundle from. */
declare const __DEVNOTES_SERVER_URL__: string | undefined
