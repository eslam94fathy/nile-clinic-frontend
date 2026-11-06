import { THEME_STORAGE_KEY } from "./theme-constants";

// Fixed text with no API data. It runs while the HTML is parsed, so the first paint is already right.
// A Content Security Policy must allow it by hash or nonce (ADR 0007).
const script = `(function(){var t;try{t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch(e){}if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t})()`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
