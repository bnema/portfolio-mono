import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { formatDistanceToNow } from "date-fns";

interface Commit {
  id: string;
  repo_name: string;
  message: string;
  timestamp: string;
  url: string;
  is_private: boolean;
}

@customElement("commit-list")
export class CommitList extends LitElement {
  @state() private commits: Commit[] = [];
  @state() private loading = false;
  @state() private error: string | null = null;
  @state() private page = 1;
  @state() private hasMore = true;
  @state() private newCommits: Commit[] = [];

  private apiUrl = import.meta.env.VITE_API_URL;
  private limit = 20;
  private refreshInterval: number | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.fetchCommits();
    this.addEventListener("scroll", this.handleScroll);

    this.refreshInterval = setInterval(() => {
      this.refreshCommits();
    }, 60000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("scroll", this.handleScroll);

    // Clear the refresh interval when the component is disconnected
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  async fetchCommits() {
    if (this.loading || !this.hasMore) return;

    this.loading = true;
    try {
      const response = await fetch(
        `${this.apiUrl}/commits?page=${this.page}&limit=${this.limit}`,
      );
      if (!response.ok) throw new Error("Failed to fetch commits");
      const data = await response.json();
      this.commits = [...this.commits, ...data.commits];
      this.hasMore = this.commits.length < data.total_count;
      this.page++;
    } catch (e) {
      this.error = e instanceof Error ? e.message : "An unknown error occurred";
    } finally {
      this.loading = false;
    }
  }

  // Fetch the latest commits and update the list
  async refreshCommits() {
    if (this.loading) return;
    this.loading = true;
    try {
      const response = await fetch(
        `${this.apiUrl}/commits?page=1&limit=${this.limit}`,
      );
      if (!response.ok) throw new Error("Failed to fetch commits");
      const data = await response.json();
      this.newCommits = data.commits;

      // Compare new commits with existing ones and update as needed
      this.updateCommits();

      this.hasMore = this.commits.length < data.total_count;
      this.page = 2; // Set to 2 for next fetch if needed
    } catch (e) {
      this.error = e instanceof Error ? e.message : "An unknown error occurred";
    } finally {
      this.loading = false;
    }
  }

  // Update the commits array with new commits
  private updateCommits() {
    const updatedCommits = [...this.newCommits];
    let changed = false;

    for (const commit of this.commits) {
      if (!this.newCommits.some((newCommit) => newCommit.id === commit.id)) {
        updatedCommits.push(commit);
        changed = true;
      }
    }

    if (changed || updatedCommits.length !== this.commits.length) {
      this.commits = updatedCommits;
    }
  }

  handleScroll = () => {
    if (this.scrollTop + this.clientHeight >= this.scrollHeight - 200) {
      this.fetchCommits();
    }
  };

  formatTimestamp(timestamp: string): string {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  }

  render() {
    return html`
      <h1>Latest activity</h1>
      <ul>
        ${this.commits.map(
          (commit) => html`
            <li>
              <h2>
                <a href=${commit.url} target="_blank" rel="noopener noreferrer">
                  ${commit.repo_name}
                </a>
                <span> - ${this.formatTimestamp(commit.timestamp)}</span>
              </h2>
              <p>
                ${commit.message.split("\n").map((line) => html`${line}<br />`)}
              </p>
            </li>
          `,
        )}
      </ul>
      ${this.loading ? html`<p>Loading commits...</p>` : null}
      ${this.error ? html`<p>Error: ${this.error}</p>` : null}
      ${!this.hasMore ? html`<p>No more commits to load.</p>` : null}
    `;
  }

  static styles = css`
    :host {
      display: block;
      font-family: "Fira Sans", sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      height: 100vh;
      overflow-y: auto;
    }
    ul {
      list-style-type: none;
      padding: 0;
    }
    li {
      margin-bottom: 20px;
      border-bottom: 1px solid #ccc;
      padding-bottom: 20px;
    }
    h1 {
      color: #333;
    }
    h2 {
      color: #666;
      margin: 0;
    }

    h2 span {
      color: #999;
      font-size: 0.8em;
    }

    a {
      text-decoration: none;
      color: inherit;
    }
    a:hover {
      text-decoration: underline;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "commit-list": CommitList;
  }
}
