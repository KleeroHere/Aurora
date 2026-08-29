import type { HelpScreenId } from "./helpTypes";

export function screenIdForPath(pathname: string): HelpScreenId {
  if (pathname === "/" || pathname === "") return "home";
  if (pathname.startsWith("/material/new")) return "material-create";
  if (pathname.endsWith("/edit") && pathname.startsWith("/material/")) return "material-edit";
  if (pathname.startsWith("/material/")) return "material";
  if (pathname.startsWith("/section/")) return "section";
  if (pathname.startsWith("/macro/")) return "macro";
  if (pathname.startsWith("/tag/")) return "tag";
  if (pathname.startsWith("/admin/journal")) return "admin-journal";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/changelog")) return "changelog";
  return "home";
}

export const SCREEN_TITLES: Record<HelpScreenId, string> = {
  home: "Home page",
  section: "Section",
  macro: "Area",
  tag: "Collection by tag",
  material: "Material",
  "material-edit": "Article editing",
  "material-create": "New material",
  settings: "Settings",
  admin: "Admin panel",
  "admin-journal": "Change log",
  changelog: "What's new",
};
