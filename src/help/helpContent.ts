import type { HelpTopic, HelpTourStep } from "./helpTypes";

export const HELP_TOPICS: HelpTopic[] = [
  // ------------------------------------------------------------------
  // ------------------------------------------------------------------
  {
    anchor: "sidebar-identity",
    screen: "global",
    order: 10,
    title: "Back to the home page",
    body: "The app name with its mark is a link to the home page. Click it any time you feel lost and want to start over. Nothing will be lost.",
  },
  {
    anchor: "theme-toggle",
    screen: "global",
    order: 20,
    title: "Light and dark",
    body: "Switches the app between light and dark looks. Dark is comfortable in the evening and on night shifts - easier on the eyes.\n\nThe choice is remembered for you personally. If another consultant works at this same computer, they will keep their own look.",
  },
  {
    anchor: "sidebar-search",
    screen: "global",
    order: 30,
    title: "Filter the list on the left",
    body: "Narrows down the list of sections on the left. Type a couple of letters from a title - only matching materials will remain, the rest will be hidden.\n\nThis searches titles only. To search the text inside articles, use the big search at the top.",
  },
  {
    anchor: "sidebar-nav",
    screen: "global",
    order: 40,
    title: "Sections and materials",
    body: "The app's main menu. Sections are collapsed - click a name to expand the list of materials inside, and click again to collapse it back.\n\nYou can keep several sections open at once.",
  },
  {
    anchor: "sidebar-admin-link",
    screen: "global",
    order: 50,
    title: "Admin panel",
    body: "The Aurora mark at the bottom leads to the admin panel: accounts, sections, database backup and restore.\n\nOn the way in the app asks for the password again - so that an accidental click does not land someone in the settings.",
  },
  {
    anchor: "sync-indicator",
    screen: "global",
    order: 60,
    title: "Save indicator",
    body: "Shows that the app has written down the latest changes. There is no \"save\" button to press anywhere - everything is saved by itself, immediately.\n\nThe app works without the internet. Everything is stored on this computer.",
  },
  {
    anchor: "topbar-search",
    screen: "global",
    order: 70,
    title: "Search across all materials",
    body: "Searches titles and the text inside articles. A few letters are enough - suggestions appear right away as you type.\n\nIf you start the line with the # sign, the app searches by tags. For example, #crisis shows everything tagged with that word.",
  },
  {
    anchor: "topbar-emergency",
    screen: "global",
    order: 80,
    title: "Emergency",
    body: "A red button for when seconds count. It opens the \"Crisis situations\" section and clears everything unnecessary off the screen - only the protocols remain.\n\nYou can leave with the \"End emergency mode\" button, it is always at the top.",
  },
  {
    anchor: "topbar-settings",
    screen: "global",
    order: 90,
    title: "Settings",
    body: "This is where you adjust the app's appearance to your liking: colors, performance on a slow computer, what to show on the home page.\n\nThese settings are personal and do not affect anyone else on shift.",
  },
  {
    anchor: "user-avatar",
    screen: "global",
    order: 100,
    title: "Who is working now",
    body: "Shows whose account the app is opened under. From here you can also sign out so the next consultant can take over the computer.\n\nThis matters: every edit to an article is signed with the name of the person who made it.",
  },
  {
    anchor: "breadcrumbs",
    screen: "global",
    order: 110,
    title: "Where you are",
    body: "This line shows the path: which area and section brought you to this page. Every link in it is clickable - you can step back at any point.",
  },
  {
    anchor: "help-button",
    screen: "global",
    order: 120,
    title: "This very help",
    body: "The question mark is on every screen. Click it anywhere in the app - and everything you see around will be labeled and explained.\n\nFrom here you can also start a short tour of the app. Close the hints with the Esc key or the \"Close\" button.",
  },

  // ------------------------------------------------------------------
  // ------------------------------------------------------------------
  {
    anchor: "home-search",
    screen: "home",
    order: 200,
    title: "Where to start",
    body: "The fastest way to find what you need is to type a few words here. The app searches both titles and the text inside articles.\n\nIf you do not remember the exact title, write it the way you remember it - the app will suggest something similar.",
  },
  {
    anchor: "home-stats",
    screen: "home",
    order: 210,
    title: "How much is in the base",
    body: "How many materials and sections are in the app right now and when something was last added. Useful for knowing how fresh the base is.",
  },
  {
    anchor: "home-macro-grid",
    screen: "home",
    order: 220,
    title: "Three big areas",
    body: "All materials are laid out across broad areas - the daily programme, protocols, journals and forms. Click a card to see which sections are inside.\n\nIt is the same thing as the list on the left, just bigger and easier to scan.",
  },
  {
    anchor: "home-pinned",
    screen: "home",
    order: 230,
    title: "Quick shelf",
    body: "Whatever you marked as needed at hand ends up here. Every article has a pin icon - click it, and the article appears on this shelf.\n\nEach person has their own shelf. It is handy to keep a few documents you open every day there, so you do not have to search for them again.",
  },
  {
    anchor: "home-affirmation",
    screen: "home",
    order: 240,
    title: "Thought of the day",
    body: "A short phrase that changes every day. If it gets in the way, you can turn it off for good in the settings.",
  },
  {
    anchor: "home-changelog",
    screen: "home",
    order: 250,
    title: "What's new",
    body: "A list of what appeared in the app in recent updates. If one day something in the app looks different from yesterday, the explanation will be here.",
  },

  // ------------------------------------------------------------------
  // ------------------------------------------------------------------
  {
    anchor: "macro-sections",
    screen: "macro",
    order: 300,
    title: "Sections of this area",
    body: "The sections that belong to this area. Under each one it says how many materials are inside. Click any of them to open its contents.",
  },
  {
    anchor: "section-materials",
    screen: "section",
    order: 310,
    title: "Section materials",
    body: "Everything that belongs to this section. A card shows the title, tags and when the material was last changed.\n\nHover over a card and quick buttons appear: peek inside without opening, pin to the shelf, print.",
  },
  {
    anchor: "section-search",
    screen: "section",
    order: 312,
    title: "Search within the section",
    body: "Searches only this section, not the whole app. Handy when you know for sure the document is here, but there are many of them.",
  },
  {
    anchor: "section-filters",
    screen: "section",
    order: 314,
    title: "Filter by type and tags",
    body: "The buttons at the top narrow the list: show only forms, only articles, or only what is tagged with a certain word. Next to each button it says how many materials match.\n\nYou can press several at once. The \"Reset\" button brings back the full list.",
  },
  {
    anchor: "card-actions",
    screen: "global",
    order: 320,
    title: "Quick buttons on a card",
    body: "They appear when you hover over a card and let you skip opening the material. Hover over any of them - the app will tell you what it does.\n\nThe magnifier peeks inside: the content shows on top of the list and closes with a click outside or the Esc key. The space bar does the same. The pin puts the material on your shelf on the home page, the printer sends it straight to print, and the chain links copy a link - you can paste it into another article.",
  },
  {
    anchor: "tag-materials",
    screen: "tag",
    order: 330,
    title: "Collection by tag",
    body: "All materials tagged with the same word are gathered here together. Tags are added by hand and help collect documents from different sections around one topic.",
  },

  // ------------------------------------------------------------------
  // ------------------------------------------------------------------
  {
    anchor: "material-body",
    screen: "material",
    order: 400,
    title: "Material text",
    body: "The document itself. It reads like a regular page - scroll down with the mouse wheel.\n\nThe thin bar at the top shows how much of it you have already read.",
  },
  {
    anchor: "material-actions",
    screen: "material",
    order: 410,
    title: "Buttons above the material",
    body: "\"Pin\" puts the material on your quick shelf on the home page. \"Edit\" opens the text for editing.\n\n\"View and manage\" unfolds an extra panel: there you can move the material to another section or delete it.",
  },
  {
    anchor: "material-zen",
    screen: "material",
    order: 412,
    title: "Reading mode",
    body: "Clears the menu and everything else off the screen - only the text remains. Helps when you need to read a long document carefully.\n\nTo leave: the same button or the Esc key.",
  },
  {
    anchor: "material-checklist",
    screen: "material",
    order: 414,
    title: "Checklist mode",
    body: "Appears on materials that contain lists. It turns a list into a set of checkboxes - you can tick items off as you work, like on a paper form.\n\nOnly you see the checkmarks; they are not saved into the document itself.",
  },
  {
    anchor: "material-manage",
    screen: "material",
    order: 416,
    title: "Move or delete",
    body: "\"Section\" moves the material to another section - pick the one you need and press the button next to it.\n\nDeletion is not instant: the app asks again. And right after deleting, a message appears with an \"Undo\" button - if you clicked by accident, the material is restored in full.",
  },
  {
    anchor: "material-tags",
    screen: "material",
    order: 420,
    title: "Tags",
    body: "Words that let this material be found together with similar ones. Click a tag to open everything tagged the same way.\n\nTags can be added and removed while editing the article.",
  },
  {
    anchor: "material-attachment",
    screen: "material",
    order: 430,
    title: "Attached file",
    body: "Some materials are ready-made forms and documents. Such a file opens right inside the app, can be paged through and printed - no need to download it separately.",
  },
  {
    anchor: "material-figure",
    screen: "material",
    order: 440,
    title: "Tables and diagrams",
    body: "The figure is drawn right in the app, so it is always sharp and adapts to the look you chose - light or dark.\n\nThe print button under it produces a black-and-white version: you can print it on a regular printer and hand it out on paper.",
  },
  {
    anchor: "material-related",
    screen: "material",
    order: 450,
    title: "Related materials",
    body: "The app picks documents close in topic and tags on its own. Quite often this is where you find what you were actually looking for.",
  },
  {
    anchor: "material-history",
    screen: "material",
    order: 455,
    title: "Change history",
    body: "Who edited this particular material and when. The list is short and read-only - a record cannot be fixed or erased, which is the whole point.",
  },
  {
    anchor: "print-preview",
    screen: "global",
    order: 460,
    title: "Preview before printing",
    body: "Before sending a document to the printer, the app shows how it will land on the page. Less paper wasted that way.\n\nIf you do not need this preview, you can turn it off in the settings, and printing will start right away.",
  },

  // ------------------------------------------------------------------
  // ------------------------------------------------------------------
  {
    anchor: "editor-section",
    screen: "material-edit",
    order: 500,
    title: "Section",
    body: "Which section the article lives in. Pick another one and the article moves there - it will no longer be in the old section.\n\nLinks to it will not break.",
  },
  {
    anchor: "editor-body",
    screen: "material-edit",
    order: 510,
    title: "Article text",
    body: "An article is assembled from blocks: a paragraph, a heading, a list, a table, a picture. Put the cursor at the end of a paragraph and press Enter - a new one appears.\n\nTo the left of each block there is a plus icon: it opens the list of what can be added. The dots icon next to it lets you move or delete a block.",
  },
  {
    anchor: "editor-tags",
    screen: "material-edit",
    order: 520,
    title: "Article tags",
    body: "This is where you add the words the article will later be found by. Write one word at a time - for example \"crisis\", \"onboarding\".\n\nTwo or three precise tags beat ten generic ones.",
  },
  {
    anchor: "editor-save",
    screen: "material-edit",
    order: 530,
    title: "Save or cancel",
    body: "\"Save\" writes the changes down and records in the log who edited the article and when. \"Cancel\" leaves the page with the previous text untouched.\n\nWhile you write, the app keeps saving a draft on its own - the note next to it shows when that last happened. If the computer shuts down, what you typed is not lost: the next time you open this article, you will be offered to restore the draft.",
  },
  {
    anchor: "create-form",
    screen: "material-create",
    order: 540,
    title: "New material",
    body: "Give it a title and pick the section it should live in - and you can start writing.\n\nThe section can be changed later; a material is not glued to it forever.",
  },

  // ------------------------------------------------------------------
  // ------------------------------------------------------------------
  {
    anchor: "settings-appearance",
    screen: "global",
    order: 600,
    title: "Appearance",
    body: "\"Palette\" is the color scheme. \"Lightness\" is the same as the toggle at the top left. These two are remembered for you personally: the next consultant at this same computer will see their own.\n\n\"Performance\": if the computer is old and the app stutters, turn on the lite look - smooth transitions disappear and everything gets faster. This setting belongs to the computer, not the person, and is shared by everyone who works on it - by design: a slow computer is slow for everyone.\n\nThe remaining toggles - day-night mode, print preview, thought of the day - are also remembered on the computer for now, not per person.",
  },

  // ------------------------------------------------------------------
  // ------------------------------------------------------------------
  {
    anchor: "admin-users",
    screen: "admin",
    order: 700,
    title: "Accounts",
    body: "The list of people who can sign in to the app. The form below adds a new one: name, login and password.\n\nAny account's password can be changed right here - no need to know the old one. That is what you do when someone forgets their password.\n\nThe app cannot delete accounts yet. If someone leaves the centre, change their password and they will no longer be able to sign in.",
  },
  {
    anchor: "admin-sections",
    screen: "admin",
    order: 710,
    title: "Sections",
    body: "Here you can add a new section and hide any existing one. A hidden section disappears from the left menu for everyone at once, but nothing is deleted - the same button brings it back.\n\nThat is handy when a section is not ready yet or is temporarily not needed.\n\nRenaming and deleting sections is not allowed - on purpose: materials link to them.",
  },
  {
    anchor: "admin-backup",
    screen: "admin",
    order: 720,
    title: "Backup and transfer",
    body: "\"Export database\" packs the app's entire contents into a single file. Save it to a flash drive - it is your copy in case something happens to the computer.\n\n\"Import database\" unpacks such a file back. The same method moves materials to a second computer: export here, carry the file over, import there.\n\nMake a copy at least once a month. The third button, \"Export seed\", is only needed by the developer when building a new version - regular users will not need it.",
  },
  {
    anchor: "admin-diagnostics",
    screen: "admin",
    order: 725,
    title: "Diagnostics",
    body: "Collects a service file describing how the app has been behaving lately. It does not fix anything by itself.\n\nIt is needed in one case: if the app acted strangely - click here, save the file and send it to the developer. It shows what happened.",
  },
  {
    anchor: "admin-journal-link",
    screen: "admin",
    order: 730,
    title: "Change log",
    body: "Leads to the list of all edits: who changed what and when. It is opened rarely, but in a disputed situation it answers the question \"who fixed this\".",
  },
  {
    anchor: "journal-list",
    screen: "admin-journal",
    order: 740,
    title: "Filtering entries",
    body: "The full list of edits across the whole app: who changed what and when. Newest first.\n\nThese fields narrow the list - you can look at one person's edits, deletions only, or just the dates you need.",
  },
  {
    anchor: "changelog-list",
    screen: "changelog",
    order: 750,
    title: "Update history",
    body: "What changed in the app itself from version to version. Here you can see what is new and what was fixed.",
  },
];

export const HELP_TOUR: HelpTourStep[] = [
  {
    path: "/",
    anchor: null,
    title: "Hello",
    body: "This is Aurora - the centre's handbook. Protocols, forms, shift journals and training videos all live here, and all of it works without the internet.\n\nLet me show you around in a minute. If now is not the time, press \"Skip\" - the tour can always be restarted from the settings.",
  },
  {
    path: "/",
    anchor: "sidebar-nav",
    title: "Everything is on the left",
    body: "Materials are laid out by section. Click a section name to expand the list inside.\n\nThis list is always in place, whatever screen you are on.",
  },
  {
    path: "/",
    anchor: "home-search",
    title: "Searching is fastest",
    body: "If you know what you need, do not scan the sections by eye. Type a few words - the app searches both titles and the text inside.",
  },
  {
    path: "/",
    anchor: "home-pinned",
    title: "A shelf at hand",
    body: "Documents you need every day can be pinned here - with the pin icon on a material card. Each person has their own shelf.",
  },
  {
    path: "/",
    anchor: "topbar-emergency",
    title: "For emergencies",
    body: "The red button opens the emergency protocols and clears everything unnecessary off the screen. May you never need it, but you should know it is there.",
  },
  {
    path: "/",
    anchor: "theme-toggle",
    title: "Make it yours",
    body: "In the evening and on night shifts the dark look is more comfortable. The app remembers your choice - another person at this same computer will see their own look.",
  },
  {
    path: "/",
    anchor: "help-button",
    title: "If something is unclear",
    body: "The question mark is on every screen. Click it wherever a question comes up - and everything you see around will be explained.\n\nThat is all. Have a good day.",
  },
];

export const HELP_BY_ANCHOR = new Map(HELP_TOPICS.map((topic) => [topic.anchor, topic]));

export const CHROME_ANCHORS: ReadonlySet<string> = new Set([
  "sidebar-identity",
  "sidebar-search",
  "sidebar-nav",
  "sidebar-admin-link",
  "theme-toggle",
  "sync-indicator",
  "topbar-search",
  "topbar-emergency",
  "topbar-settings",
  "user-avatar",
  "breadcrumbs",
  "help-button",
]);

export function isChromeTopic(anchor: string): boolean {
  return CHROME_ANCHORS.has(anchor);
}
