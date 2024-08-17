import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { formatDistanceToNow } from "date-fns";
import { Commit } from "./types.ts";
import { CommitService } from "./commit-service";

@customElement("commit-list")
export class CommitList extends LitElement {
  @state() private commits: Commit[] = [];
  @state() private loading = false;
  @state() private error: string | null = null;
  @state() private page = 1;
  @state() private hasMore = true;
  @state() private newCommits: Commit[] = [];

  private commitService: CommitService;
  private limit = 10;
  private refreshInterval: number | null = null;

  constructor() {
    super();
    this.commitService = new CommitService(import.meta.env.VITE_API_URL);
  }

  connectedCallback() {
    super.connectedCallback();
    this.refreshCommits();
    this.setupInfiniteScroll();
    this.setupRefreshInterval();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.teardownInfiniteScroll();
    this.clearRefreshInterval();
  }

  private async fetchCommits() {
    if (this.loading || !this.hasMore) return;

    this.loading = true;
    try {
      const data = await this.commitService.fetchCommits(this.page, this.limit);
      const newCommits = data.commits.map((commit) => ({
        ...commit,
        isNew: true,
      }));
      this.commits = [...this.commits, ...newCommits];
      this.hasMore = this.commits.length < data.total_count;
      this.page++;

      // Schedule removal of 'isNew' flag
      setTimeout(() => {
        this.commits = this.commits.map((commit) => ({
          ...commit,
          isNew: false,
        }));
      }, 500);
    } catch (e) {
      this.error = e instanceof Error ? e.message : "An unknown error occurred";
    } finally {
      this.loading = false;
    }
  }

  private async refreshCommits() {
    if (this.loading) return;
    this.loading = true;
    try {
      const data = await this.commitService.fetchCommits(1, this.limit);
      this.newCommits = data.commits;
      this.updateCommits();
      this.hasMore = this.commits.length < data.total_count;
      this.page = 2;
    } catch (e) {
      this.error = e instanceof Error ? e.message : "An unknown error occurred";
    } finally {
      this.loading = false;
    }
  }

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

  private setupInfiniteScroll() {
    window.addEventListener("scroll", this.handleScroll);
  }

  private teardownInfiniteScroll() {
    window.removeEventListener("scroll", this.handleScroll);
  }

  private handleScroll = () => {
    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    if (scrollY + windowHeight >= documentHeight - 200) {
      this.fetchCommits();
    }
  };

  private setupRefreshInterval() {
    this.refreshInterval = setInterval(() => {
      this.refreshCommits();
    }, 60000);
  }

  private clearRefreshInterval() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  render() {
    return html`
      <h1>Latest activity</h1>
      <ul>
        ${this.commits.map((commit) => this.renderCommit(commit))}
      </ul>
      <div class="load-more">
        <button @click=${this.fetchCommits} ?disabled=${this.loading}>
          Load more
        </button>
      </div>
      ${this.renderStatus()}
    `;
  }

  private renderCommit(commit: Commit) {
    return html`
      <li class="${commit.isNew ? "new-commit" : ""}">
        <div class="commit-header">
          <h2 class=${commit.is_private ? "private-commit" : ""}>
            <a href=${commit.url} target="_blank" rel="noopener noreferrer">
              ${commit.repo_name}
            </a>
          </h2>
          <span class="origin-info"
            ><sl-icon name="github"></sl-icon> ${this.formatTimestamp(
              commit.timestamp,
            )}</span
          >
        </div>
        <p class=${commit.is_private ? "private-commit" : ""}>
          ${commit.message.split("\n").map((line) => html`${line}<br />`)}
        </p>
      </li>
    `;
  }

  private renderStatus() {
    if (this.loading) return html`<p>Loading commits...</p>`;
    if (this.error) return html`<p>Error: ${this.error}</p>`;
    if (!this.hasMore) return html`<p>No more commits to load.</p>`;
    return null;
  }

  private formatTimestamp(timestamp: string): string {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  }

  static styles = css`
    :host {
      display: block;
      font-family: "Fira Sans", sans-serif;
      margin: 0 auto;
      padding: 2rem;
      // height: 100vh;
      // overflow-y: auto;
    }

    .private-commit {
      filter: blur(2px);
    }

    .commit-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .origin-info {
      display: flex;
      align-items: center;
      color: var(--muted-color);
      font-size: 0.9em;
    }

    .origin-info sl-icon {
      margin-right: 0.5em;
    }

    .timestamp {
      vertical-align: middle;
    }

    ul {
      list-style-type: none;
      padding: 0;
    }
    li {
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.5rem;
    }
    h1 {
      color: var(--heading-color);
      font-size: 1.5em;
    }
    h2 {
      color: var(--subheading-color);
      margin: 0;
      line-height: 1.5;
    }
    h2 img {
      vertical-align: middle;
      margin-right: 0.5rem;
      opacity: 0.7;
    }
    h2 span {
      color: var(--muted-color);
      font-size: 0.8em;
      vertical-align: middle;
    }
    a {
      font-weight: 500;
      color: var(--text-color);
      text-decoration: inherit;
      transition: color 0.2s;
    }
    a:hover {
      color: var(--link-hover-color);
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .load-more {
      text-align: center;
      margin-top: 2rem;
    }

    .load-more button {
      padding: 0.5rem 1rem;
      font-size: 0.8em;
      rounded: 1rem;
    }

    .new-commit {
      animation: fadeIn 1s ease-out;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "commit-list": CommitList;
  }
}
