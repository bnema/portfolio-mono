import { LitElement, html, css } from "lit";
import { property } from "lit/decorators.js";

export class ThemeSwitcher extends LitElement {
  static styles = css`
    .theme-switch {
      display: inline-block;
      height: 34px;
      position: relative;
      width: 60px;
    }
    .theme-switch input {
      display: none;
    }
    .slider {
      background-color: rgba(0, 0, 0, 0.1);
      bottom: 0;
      cursor: pointer;
      left: 0;
      position: absolute;
      right: 0;
      top: 0;
      transition: 0.4s;
    }
    .slider:before {
      background-color: #f1c40f;
      bottom: 4px;
      content: "";
      height: 26px;
      left: 4px;
      position: absolute;
      transition: 0.4s;
      width: 26px;
    }

    input:checked + .slider {
      // background-color: #66bb6a;
    }
    input:checked + .slider:before {
      transform: translateX(26px);
    }
    .slider.round {
      border-radius: 34px;
    }
    .slider.round:before {
      border-radius: 50%;
    }
    .emoji {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      font-size: 20px;
    }
    .sun {
      left: 6px;
    }
    .moon {
      right: 6px;
    }
  `;

  @property({ type: Boolean })
  checked = false;

  constructor() {
    super();
    this.detectColorScheme();
  }

  render() {
    return html`
      <label class="theme-switch" for="checkbox">
        <input
          type="checkbox"
          id="checkbox"
          .checked=${this.checked}
          @change=${this.switchTheme}
        />
        <div class="slider round">
          <span class="emoji sun">☀️</span>
          <span class="emoji moon">🌑</span>
        </div>
      </label>
    `;
  }

  detectColorScheme() {
    let theme = "light"; // default to light
    if (localStorage.getItem("theme")) {
      theme = localStorage.getItem("theme") || "light";
    } else if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      theme = "dark";
    }
    this.setTheme(theme);
  }

  setTheme(theme: string) {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.classList.toggle(
      "sl-theme-dark",
      theme === "dark",
    );
    this.checked = theme === "dark";
    localStorage.setItem("theme", theme);
  }

  switchTheme(e: Event) {
    const target = e.target as HTMLInputElement;
    const newTheme = target.checked ? "dark" : "light";
    this.setTheme(newTheme);
  }
}

customElements.define("theme-switcher", ThemeSwitcher);

declare global {
  interface HTMLElementTagNameMap {
    "theme-switcher": ThemeSwitcher;
  }
}
