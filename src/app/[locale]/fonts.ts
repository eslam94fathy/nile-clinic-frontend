import localFont from "next/font/local";

// `adjustFontFallback: false` matters on both. With a generated fallback, which has Arial's metrics
// and Arabic glyphs, Arabic text stops there and the Arabic font never loads (ADR 0007).
export const latin = localFont({
  src: "../../../node_modules/@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2",
  variable: "--font-latin",
  weight: "100 700",
  adjustFontFallback: false,
  fallback: [],
});

export const arabic = localFont({
  src: [
    {
      path: "../../../node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-400-normal.woff2",
      weight: "400",
    },
    {
      path: "../../../node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-500-normal.woff2",
      weight: "500",
    },
    {
      path: "../../../node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-600-normal.woff2",
      weight: "600",
    },
  ],
  variable: "--font-arabic",
  adjustFontFallback: false,
  fallback: [],
});
