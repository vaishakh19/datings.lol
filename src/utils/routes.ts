import { LEGAL_DOCS } from "../data/legal";

export const LEGAL_PATHS = new Set(LEGAL_DOCS.map((doc) => `/${doc.slug}`));

/** All paths served by the public marketing site (before auth-gating the app). */
export function isMarketingPath(path: string): boolean {
  return (
    path === "/" ||
    path === "/blog" ||
    path.startsWith("/blog/") ||
    path === "/pricing" ||
    path === "/about" ||
    LEGAL_PATHS.has(path)
  );
}

/** SPA app routes that should render inside the authenticated shell. */
export const APP_TABS = new Set(["today", "coach", "community", "profile", "admin"]);
