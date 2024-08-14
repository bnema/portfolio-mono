import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("theme-switcher")
export class ThemeSwitcher extends LitElement {
  @property({ type: Boolean }) darkTheme = true;

  static styles = css`
    :host {
      display: inline-block;
    }
    button {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 50%;
      transition: background-color 0.3s;
    }
    button:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
  `;

  render() {
    return html`
      <button @click=${this.toggleTheme} aria-label="Toggle theme">
        ${this.darkTheme ? "☀️" : "🌙"}
      </button>
    `;
  }

  private toggleTheme() {
    this.darkTheme = !this.darkTheme;
    document.body.classList.toggle("light-theme", !this.darkTheme);
    this.dispatchEvent(
      new CustomEvent("theme-changed", {
        detail: { darkTheme: this.darkTheme },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "theme-switcher": ThemeSwitcher;
  }
}
