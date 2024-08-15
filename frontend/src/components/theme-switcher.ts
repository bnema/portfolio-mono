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
      background-color: #ccc;
      bottom: 0;
      cursor: pointer;
      left: 0;
      position: absolute;
      right: 0;
      top: 0;
      transition: 0.4s;
    }
    .slider:before {
      background-color: #fff;
      bottom: 4px;
      content: "";
      height: 26px;
      left: 4px;
      position: absolute;
      transition: 0.4s;
      width: 26px;
    }
    input:checked + .slider {
      background-color: #66bb6a;
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
        <div class="slider round"></div>
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
