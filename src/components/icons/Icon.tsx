
export type IconName =
  | "paperclip"
  | "close"
  | "zoom-in"
  | "zoom-out"
  | "chevron-left"
  | "chevron-right"
  | "download"
  | "print"
  | "play"
  | "image"
  | "trash"
  | "refresh"
  | "pin"
  | "bold"
  | "italic"
  | "heading"
  | "list"
  | "quote"
  | "table"
  | "warning"
  | "link"
  | "maximize"
  | "minimize"
  | "undo"
  | "settings"
  | "edit"
  | "help"
  | "check-square"
  | "arrow-up";

const PATHS: Record<IconName, string | string[]> = {
  "arrow-up": "M12 19V5M5 12l7-7 7 7",
  paperclip:
    "M9 12.5 15.5 6a3 3 0 1 1 4.24 4.24l-8.5 8.5a5 5 0 1 1-7.07-7.07l7.79-7.79",
  close: "M6 6l12 12M18 6 6 18",
  "zoom-in": "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM21 21l-4.35-4.35M11 8v6M8 11h6",
  "zoom-out": "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM21 21l-4.35-4.35M8 11h6",
  "chevron-left": "M15 18l-6-6 6-6",
  "chevron-right": "M9 6l6 6-6 6",
  download: "M12 4v12m0 0 4-4m-4 4-4-4M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1",
  print: "M7 8V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v4M7 17h10M6 8h12a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2v3a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-3H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2Z",
  play: "M8 5.5v13l11-6.5-11-6.5Z",
  image: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-5 8 6-6 4 4 3-3 5 5",
  trash: "M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-12",
  refresh: "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  pin: "M12 21s-7-6.31-7-11.2A7 7 0 0 1 19 9.8C19 14.69 12 21 12 21ZM12 12a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z",
  bold: "M7 4h6a3.5 3.5 0 0 1 0 7H7Zm0 7h7a3.5 3.5 0 0 1 0 7H7Z",
  italic: "M11 4h6M7 20h6M14 4 10 20",
  heading: "M6 4v16M18 4v16M6 12h12",
  list: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  quote: "M7 8a3 3 0 0 0-3 3v2a3 3 0 0 0 3 3M17 8a3 3 0 0 0-3 3v2a3 3 0 0 0 3 3",
  table: "M4 5h16v14H4zM4 10h16M4 15h16M10 5v14",
  warning: "M12 4 2 20h20L12 4ZM12 10v4m0 3h.01",
  link: "M9.5 14.5 14.5 9.5M8 12l-2.5 2.5a3.5 3.5 0 0 0 5 5L13 17M16 12l2.5-2.5a3.5 3.5 0 0 0-5-5L11 7",
  maximize: "M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4",
  minimize: "M9 4v4a1 1 0 0 1-1 1H4M15 4v4a1 1 0 0 0 1 1h4M9 20v-4a1 1 0 0 0-1-1H4M15 20v-4a1 1 0 0 1 1-1h4",
  undo: "M7 8 3 12l4 4M3 12h11a6 6 0 0 1 0 12h-1",
  edit: "M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z",
  help: [
    "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z",
    "M9.6 9.2a2.5 2.5 0 1 1 3.3 2.4c-.8.3-1.3 1-1.3 1.9v.4",
    "M12 17.2h.01",
  ],
  settings: [
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82A1.65 1.65 0 0 0 3.09 13H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z",
  ],
  "check-square": [
    "M5 5h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
    "M8 12.5l2.5 2.5L16 9",
  ],
};

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  "aria-hidden"?: boolean;
}

export default function Icon({ name, size = 16, className, ...rest }: IconProps) {
  const d = PATHS[name];
  const paths = Array.isArray(d) ? d : [d];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {paths.map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}
