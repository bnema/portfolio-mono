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
  private limit = 20;
  private refreshInterval: number | null = null;

  constructor() {
    super();
    this.commitService = new CommitService(import.meta.env.VITE_API_URL);
  }

  connectedCallback() {
    super.connectedCallback();
    this.fetchCommits();
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
      this.commits = [...this.commits, ...data.commits];
      this.hasMore = this.commits.length < data.total_count;
      this.page++;
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
    this.addEventListener("scroll", this.handleScroll);
  }

  private teardownInfiniteScroll() {
    this.removeEventListener("scroll", this.handleScroll);
  }

  private handleScroll = () => {
    if (this.scrollTop + this.clientHeight >= this.scrollHeight - 200) {
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
      ${this.renderStatus()}
    `;
  }

  private renderCommit(commit: Commit) {
    return html`
      <li>
        <h2>
          <img
            src="https://github.com/favicon.ico"
            alt="Github"
            width="24"
            height="24"
          />
          <a href=${commit.url} target="_blank" rel="noopener noreferrer">
            ${commit.repo_name}
          </a>
          <span> - ${this.formatTimestamp(commit.timestamp)}</span>
        </h2>
        <p>${commit.message.split("\n").map((line) => html`${line}<br />`)}</p>
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
      height: 100vh;
      overflow-y: auto;
    }
    ul {
      list-style-type: none;
      padding: 0;
    }
    li {
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 2rem;
    }
    h1 {
      color: var(--heading-color);
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
