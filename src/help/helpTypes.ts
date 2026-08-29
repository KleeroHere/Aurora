
export type HelpAnchor = string;

export type HelpScreenId =
  | "home"
  | "section"
  | "macro"
  | "tag"
  | "material"
  | "material-edit"
  | "material-create"
  | "settings"
  | "admin"
  | "admin-journal"
  | "changelog";

export interface HelpTopic {
  anchor: HelpAnchor;
  title: string;
  body: string;
  order: number;
  screen: HelpScreenId | "global";
}

export interface HelpTourStep {
  path: string | null;
  anchor: HelpAnchor | null;
  title: string;
  body: string;
}
