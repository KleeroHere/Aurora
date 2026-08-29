
export const CONNECTED_TOOLS = [
  "paragraph",
  "header",
  "list",
  "quote",
  "table",
  "alert",
  "image",
  "attaches",
  "internalLink",
] as const;

export const EDITOR_I18N = {
  messages: {
    ui: {
      blockTunes: {
        toggler: {
          "Click to tune": "Click to tune",
          "or drag to move": "or drag to move",
        },
      },
      inlineToolbar: {
        converter: {
          "Convert to": "Convert to",
        },
      },
      toolbar: {
        toolbox: {
          Add: "Add",
          Filter: "Search",
          "Nothing found": "Nothing found",
        },
      },
      popover: {
        Filter: "Search",
        "Nothing found": "Nothing found",
        "Convert to": "Convert to",
      },
    },

    toolNames: {
      Text: "Text",
      Heading: "Heading",
      List: "List",
      Quote: "Quote",
      Table: "Table",
      Alert: "Warning",
      Image: "Image",
      Attaches: "File",
      Attachment: "File",
      Bold: "Bold",
      Italic: "Italic",
      Link: "Link",
      InternalLink: "Link to material",
      Marker: "Highlight",
      InlineCode: "Monospace",
    },

    tools: {
      warning: {
        Title: "Title",
        Message: "Text",
      },
      link: {
        "Add a link": "Add a link",
      },
      stub: {
        "The block can not be displayed correctly.": "The block could not be displayed.",
      },
      list: {
        Unordered: "Bulleted",
        Ordered: "Numbered",
        Checklist: "Checklist",
        "Start with": "Start with",
        "Counter type": "Counter type",
        Numeric: "Numbers",
        "Lower Roman": "Lowercase Roman",
        "Upper Roman": "Uppercase Roman",
        "Lower Alpha": "Lowercase letters",
        "Upper Alpha": "Uppercase letters",
      },
      header: {
        "Heading 1": "Heading 1",
        "Heading 2": "Heading 2",
        "Heading 3": "Heading 3",
        "Heading 4": "Heading 4",
        "Heading 5": "Heading 5",
        "Heading 6": "Heading 6",
      },
      quote: {
        "Enter a quote": "Quote text",
        "Quote's author": "Author",
        "Align left": "Align left",
        "Align center": "Align center",
      },
      table: {
        "With headings": "With headings",
        "Without headings": "Without headings",
        Stretch: "Full width",
        Collapse: "Regular width",
        "Add column to left": "Add column to left",
        "Add column to right": "Add column to right",
        "Delete column": "Delete column",
        "Add row above": "Add row above",
        "Add row below": "Add row below",
        "Delete row": "Delete row",
        Heading: "Heading",
      },
      alert: {
        Primary: "Primary",
        Secondary: "Secondary",
        Info: "Info",
        Success: "Success",
        Warning: "Warning",
        Danger: "Danger",
        Light: "Light",
        Dark: "Dark",
        "Left align": "Align left",
        "Center align": "Align center",
        "Right align": "Align right",
        "Type here...": "Warning text…",
      },
      image: {
        Caption: "Caption",
        "Select an Image": "Select an image",
        "With border": "With border",
        "Stretch image": "Full width",
        "With background": "With background",
      },
      attaches: {
        "File title": "File title",
      },
      internalLink: {
        "Link to material": "Link to material",
      },
    },

    blockTunes: {
      delete: {
        Delete: "Delete",
        "Click to delete": "Click again to delete",
      },
      moveUp: {
        "Move up": "Move up",
      },
      moveDown: {
        "Move down": "Move down",
      },
      filter: {
        Filter: "Search",
      },
    },
  },
} as const;

export function untranslatedTools(connected: readonly string[] = CONNECTED_TOOLS): string[] {
  const translated = new Set(Object.keys(EDITOR_I18N.messages.tools));
  const noOwnLabels = new Set(["paragraph"]);
  return connected.filter((tool) => !translated.has(tool) && !noOwnLabels.has(tool));
}
