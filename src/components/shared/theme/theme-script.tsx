import { THEME_STORAGE_KEY } from "./theme-constants";

// Fixed text with no API data. It runs while the HTML is parsed, so the first paint is already right.
// The security policy allows inline scripts, as no hash or nonce can cover the streamed ones (ADR 0021).
const script = `(function(){var t;try{t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch(e){}if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t})()`;

export function ThemeScript() {
  // The one raw HTML in the application: fixed text, built from a constant, with nothing from the API (ADR 0021).
  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
