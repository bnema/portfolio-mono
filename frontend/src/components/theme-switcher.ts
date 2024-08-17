import { LitElement, html, css } from "lit";
import { property, state } from "lit/decorators.js";

export class ThemeSwitcher extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
    }
    button {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
    }

    sl-icon:hover {
      text-decoration: none;
      color: var(--link-color);
    }

    sl-icon {
      padding-top: 0.5rem;
      padding-left: 0.5rem;
      font-size: 1rem;
      color: var(--text-color);
      transition: color 0.2s;
    }
  `;

  @property({ type: String })
  theme: "light" | "dark" = "light";

  @state()
  private prefersDarkScheme = false;

  constructor() {
    super();
    this.initializeTheme();
  }

  render() {
    const tooltipContent =
      this.theme === "light" ? "Switch to dark theme" : "Switch to light theme";

    return html`
      <sl-tooltip content="${tooltipContent}">
        <button @click=${this.toggleTheme}>
          ${this.theme === "light"
            ? html`<sl-icon
                name="moon-stars"
                aria-label="Switch to dark theme"
              ></sl-icon>`
            : html`<sl-icon
                name="brightness-high"
                aria-label="Switch to light theme"
              ></sl-icon>`}
        </button>
      </sl-tooltip>
    `;
  }

  private initializeTheme() {
    this.prefersDarkScheme = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;

    const storedTheme = localStorage.getItem("theme");

    if (storedTheme) {
      this.theme = storedTheme as "light" | "dark";
    } else {
      this.theme = this.prefersDarkScheme ? "dark" : "light";
    }

    this.applyTheme();
  }

  private toggleTheme() {
    this.theme = this.theme === "light" ? "dark" : "light";
    this.applyTheme();
  }

  private applyTheme() {
    document.documentElement.setAttribute("data-theme", this.theme);
    document.documentElement.classList.toggle(
      "sl-theme-dark",
      this.theme === "dark",
    );
    localStorage.setItem("theme", this.theme);
  }
}

customElements.define("theme-switcher", ThemeSwitcher);

declare global {
  interface HTMLElementTagNameMap {
    "theme-switcher": ThemeSwitcher;
  }
}
