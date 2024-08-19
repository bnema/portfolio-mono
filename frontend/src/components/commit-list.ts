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
    const repoUrl = this.extractRepoUrl(commit.url);

    return html`
      <li class="${commit.isNew ? "new-commit" : ""}">
        <div class="commit-header starship-style">
          <span class="user">brice</span>
          <span class="separator">in</span>
          <a
            href=${repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="repo"
          >
            <sl-icon name="github"></sl-icon>
            ${commit.repo_name}
          </a>
          <span class="separator">on</span>
          <a
            href=${commit.url}
            target="_blank"
            rel="noopener noreferrer"
            class="branch"
          >
            <sl-icon name="git"></sl-icon>
            main
          </a>
          <span class="timestamp"
            >${this.formatTimestamp(commit.timestamp)}</span
          >
        </div>
        <p class=${commit.is_private ? "private-commit" : ""}>
          ${this.formatCommitMessage(commit.message)}
        </p>
      </li>
    `;
  }

  private extractRepoUrl(commitUrl: string): string {
    // This regex matches everything up to '/commit/' in the URL
    const match = commitUrl.match(/(.*?\/.*?\/.*?)\/commit\//);
    return match ? match[1] : "#";
  }

  private formatCommitMessage(message: string) {
    return message
      .split("\n")
      .map((line) =>
        line.trim().startsWith("-")
          ? html`<span class="indented">${line}</span><br />`
          : html`${line}<br />`,
      );
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
    }

    .private-commit {
      filter: blur(2px);
    }

    .indented {
      padding-left: 0.5em;
    }

    .commit-header {
      display: flex;
      align-items: center;
    }

    .starship-style {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      font-family: "Fira Code", monospace;
      font-size: 1em;
      font-weight: 500;
      margin-bottom: 0.5em;
    }

    .starship-style .user {
      color: var(--user-color, #ff0066);
      font-weight: bold;
    }

    .starship-style .separator {
      color: var(--separator-color, #9e9e9e);
      margin: 0 0.5em;
    }

    .starship-style a {
      text-decoration: none;
      color: inherit;
    }

    .starship-style a:hover {
      text-decoration: underline;
    }

    .starship-style .repo {
      color: var(--repo-color, #2196f3);
      display: flex;
      align-items: center;
    }

    .starship-style .branch {
      color: var(--branch-color, #ffc107);
      display: flex;
      align-items: center;
    }

    .starship-style sl-icon {
      margin-right: 0.3em;
    }

    .starship-style .timestamp {
      margin-left: auto;
      color: var(--timestamp-color, #9e9e9e);
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
      font-size: 1.6em;
      padding-bottom: 1rem;
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
