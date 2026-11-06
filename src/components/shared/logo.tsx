// The kit's horizontal and Arabic-first logos, drawn inline so that the text uses the bundled fonts and
// the colors follow the theme. The kit's own files import Google Fonts, which this app must not (ADR 0009).
const LAYOUTS = {
  ltr: {
    viewBox: "0 0 460 110",
    mark: "translate(0 5)",
    anchor: "start",
    name: { x: 122, y: 52, fontSize: 46, fontWeight: 700, letterSpacing: -0.5 },
    tagline: { x: 122, y: 94, fontSize: 28, fontWeight: 600 },
  },
  rtl: {
    viewBox: "0 0 480 110",
    mark: "translate(380 5)",
    anchor: "end",
    name: { x: 358, y: 58, fontSize: 44, fontWeight: 600 },
    tagline: { x: 358, y: 96, fontSize: 22, fontWeight: 600, letterSpacing: 2 },
  },
} as const;

export function Logo({
  name,
  tagline,
  direction,
}: {
  name: string;
  tagline: string;
  direction: keyof typeof LAYOUTS;
}) {
  const layout = LAYOUTS[direction];

  // `direction` is fixed because the page's would reverse `textAnchor` and put the text over the mark.
  return (
    <svg
      role="img"
      aria-label={name}
      viewBox={layout.viewBox}
      direction="ltr"
      className="h-11 w-auto shrink-0"
    >
      <g transform={layout.mark}>
        <path
          d="M50 6C50 6 18 42 18 62a32 32 0 0 0 64 0C82 42 50 6 50 6z"
          className="fill-brand"
        />
        <path
          d="M26 64H38L44 52L52 76L58 58L62 64H74"
          fill="none"
          strokeWidth="6.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-brand-foreground"
        />
      </g>
      <text
        {...layout.name}
        textAnchor={layout.anchor}
        className="fill-brand-name"
      >
        {name}
      </text>
      <text
        {...layout.tagline}
        textAnchor={layout.anchor}
        className="fill-brand-tagline"
      >
        {tagline}
      </text>
    </svg>
  );
}
