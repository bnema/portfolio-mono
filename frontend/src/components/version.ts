import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

@customElement("version-display")
export class VersionDisplay extends LitElement {
  @state() private version: string = "Loading...";

  static styles = css`
    :host {
      display: inline-block;
    }
  `;

  async connectedCallback() {
    super.connectedCallback();
    await this.fetchVersion();
  }

  async fetchVersion() {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/version`);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const version = await response.json();
      this.version = version.trim();
    } catch (error) {
      console.error("Error fetching version:", error);
      this.version = "Unknown";
    }
  }

  render() {
    return html`<span>${this.version}</span>`;
  }
}
