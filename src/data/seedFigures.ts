// Hand-drawn SVG diagrams embedded into seeded articles as attachments.
// Each sits on its own light card so it stays readable in the dark theme.

const FONT = `font-family="'Segoe UI', Arial, sans-serif"`;

/** The shape of an ordinary day: a horizontal timeline from 07:00 to 23:00. */
export const DAY_TIMELINE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 300" role="img" aria-label="Timeline of the day">
  <rect x="1" y="1" width="958" height="298" rx="14" fill="#f6f8fb" stroke="#dde4ee"/>
  <text x="40" y="46" ${FONT} font-size="21" font-weight="600" fill="#1f2440">The shape of the day</text>
  <text x="40" y="70" ${FONT} font-size="13" fill="#6b7690">Fixed points hold the day together; everything else can move a little.</text>
  <line x1="40" y1="170" x2="920" y2="170" stroke="#c9d3e2" stroke-width="2"/>
  <g ${FONT} font-size="12" fill="#8a94ab" text-anchor="middle">
    <text x="40" y="196">07:00</text><text x="260" y="196">11:00</text>
    <text x="480" y="196">15:00</text><text x="700" y="196">19:00</text><text x="920" y="196">23:00</text>
  </g>
  <g>
    <line x1="40" y1="163" x2="40" y2="177" stroke="#c9d3e2" stroke-width="2"/>
    <line x1="260" y1="163" x2="260" y2="177" stroke="#c9d3e2" stroke-width="2"/>
    <line x1="480" y1="163" x2="480" y2="177" stroke="#c9d3e2" stroke-width="2"/>
    <line x1="700" y1="163" x2="700" y2="177" stroke="#c9d3e2" stroke-width="2"/>
    <line x1="920" y1="163" x2="920" y2="177" stroke="#c9d3e2" stroke-width="2"/>
  </g>
  <g ${FONT} font-size="12.5" font-weight="600">
    <rect x="68" y="118" width="86" height="34" rx="8" fill="#4a9d8f"/>
    <text x="111" y="139" fill="#ffffff" text-anchor="middle">Circle</text>
    <rect x="162" y="118" width="98" height="34" rx="8" fill="#5b8dd9"/>
    <text x="211" y="139" fill="#ffffff" text-anchor="middle">Chores</text>
    <rect x="288" y="118" width="86" height="34" rx="8" fill="#8a76c9"/>
    <text x="331" y="139" fill="#ffffff" text-anchor="middle">Group</text>
    <rect x="398" y="118" width="82" height="34" rx="8" fill="#c9a24a"/>
    <text x="439" y="139" fill="#ffffff" text-anchor="middle">Lunch</text>
    <rect x="508" y="118" width="104" height="34" rx="8" fill="#7fa6b8"/>
    <text x="560" y="139" fill="#ffffff" text-anchor="middle">Quiet hour</text>
    <rect x="640" y="118" width="86" height="34" rx="8" fill="#8a76c9"/>
    <text x="683" y="139" fill="#ffffff" text-anchor="middle">Group</text>
    <rect x="748" y="118" width="90" height="34" rx="8" fill="#4a9d8f"/>
    <text x="793" y="139" fill="#ffffff" text-anchor="middle">Review</text>
  </g>
  <g ${FONT} font-size="12" fill="#4c576f">
    <circle cx="111" cy="228" r="4" fill="#4a9d8f"/><text x="122" y="232">Fixed: starts on time, everyone present</text>
    <circle cx="480" cy="228" r="4" fill="#7fa6b8"/><text x="491" y="232">Protected: no meetings, no phone calls</text>
    <circle cx="745" cy="228" r="4" fill="#4a9d8f"/><text x="756" y="232">Fixed: closes the day, feeds the handover</text>
  </g>
  <g>
    <rect x="856" y="112" width="6" height="46" rx="3" fill="#1f2440"/>
    <text x="868" y="139" ${FONT} font-size="12.5" font-weight="600" fill="#1f2440">Lights out</text>
  </g>
</svg>`;

/** Night-shift escalation: four rungs from handling it yourself to the emergency call. */
export const ESCALATION_LADDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 380" role="img" aria-label="Escalation ladder">
  <rect x="1" y="1" width="958" height="378" rx="14" fill="#f6f8fb" stroke="#dde4ee"/>
  <text x="40" y="46" ${FONT} font-size="21" font-weight="600" fill="#1f2440">Who handles it, and when</text>
  <text x="40" y="70" ${FONT} font-size="13" fill="#6b7690">Start at the bottom. Move up one rung only when the current one is not enough.</text>
  <g ${FONT}>
    <rect x="40" y="296" width="880" height="56" rx="10" fill="#e7efdf" stroke="#b9cfa4"/>
    <text x="64" y="320" font-size="14.5" font-weight="600" fill="#33502a">1 - Handle it in the moment</text>
    <text x="64" y="340" font-size="12.5" fill="#4c6242">Tea, a task, a quiet word. Most nights end here. Write one line in the log.</text>
    <rect x="40" y="224" width="880" height="56" rx="10" fill="#e3ecf7" stroke="#a9c4e4"/>
    <text x="64" y="248" font-size="14.5" font-weight="600" fill="#24405e">2 - Tell the next shift</text>
    <text x="64" y="268" font-size="12.5" fill="#3d566f">Not urgent, but a pattern: poor sleep three nights, a mood that changed. Goes in the handover.</text>
    <rect x="40" y="152" width="880" height="56" rx="10" fill="#f4ead9" stroke="#dcc294"/>
    <text x="64" y="176" font-size="14.5" font-weight="600" fill="#6e5320">3 - Call the lead, tonight</text>
    <text x="64" y="196" font-size="12.5" fill="#7d6537">Someone intends to leave, a conflict will not settle, anything you want a second opinion on.</text>
    <rect x="40" y="80" width="880" height="56" rx="10" fill="#f6e2e0" stroke="#dfaaa4"/>
    <text x="64" y="104" font-size="14.5" font-weight="600" fill="#7a2f28">4 - Emergency number, then the lead</text>
    <text x="64" y="124" font-size="12.5" fill="#8a463f">Anyone unwell in a way you cannot explain. Call first, address first, meet them at the gate.</text>
  </g>
  <g stroke="#8a94ab" stroke-width="2" fill="none">
    <path d="M 936 296 L 936 142 M 930 150 L 936 140 L 942 150" transform="translate(-8,0)"/>
  </g>
</svg>`;

/** Morning circle seating: everyone in one ring, facilitator by the board, door in view. */
export const CIRCLE_SEATING_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 420" role="img" aria-label="Circle seating plan">
  <rect x="1" y="1" width="958" height="418" rx="14" fill="#f6f8fb" stroke="#dde4ee"/>
  <text x="40" y="46" ${FONT} font-size="21" font-weight="600" fill="#1f2440">Seating that keeps the circle a circle</text>
  <text x="40" y="70" ${FONT} font-size="13" fill="#6b7690">One ring, no second row, nobody behind anybody's back.</text>
  <ellipse cx="480" cy="240" rx="230" ry="130" fill="none" stroke="#c9d3e2" stroke-width="2" stroke-dasharray="6 7"/>
  <g fill="#5b8dd9">
    <circle cx="480" cy="110" r="15"/><circle cx="620" cy="140" r="15"/><circle cx="695" cy="240" r="15"/>
    <circle cx="620" cy="340" r="15"/><circle cx="480" cy="370" r="15"/><circle cx="340" cy="340" r="15"/>
    <circle cx="265" cy="240" r="15"/><circle cx="340" cy="140" r="15"/>
  </g>
  <circle cx="480" cy="110" r="15" fill="#4a9d8f"/>
  <text x="480" y="87" ${FONT} font-size="12.5" font-weight="600" fill="#2e6a60" text-anchor="middle">Facilitator - can see the door and the board</text>
  <rect x="404" y="30" width="152" height="10" rx="5" fill="#1f2440"/>
  <text x="480" y="58" ${FONT} font-size="11.5" fill="#6b7690" text-anchor="middle">the board with today's plan</text>
  <rect x="884" y="196" width="12" height="88" rx="4" fill="#c9a24a"/>
  <text x="878" y="180" ${FONT} font-size="11.5" fill="#6b7690" text-anchor="end">door - never behind the facilitator</text>
  <g ${FONT} font-size="12" fill="#4c576f">
    <circle cx="66" cy="366" r="4" fill="#5b8dd9"/><text x="77" y="370">Residents and staff sit in the same ring - no desk, no head of the table</text>
    <circle cx="66" cy="392" r="4" fill="#4a9d8f"/><text x="77" y="396">Latecomers join the ring; nobody perches outside it</text>
  </g>
</svg>`;
