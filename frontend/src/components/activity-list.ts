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
  @state() private newestCommitId: string | null = null;
  @state() private abortController: AbortController | null = null;

  private commitService: CommitService;
  private limit = 10;
  private refreshInterval: number | null = null;

  constructor() {
    super();
    this.commitService = new CommitService(import.meta.env.VITE_API_URL);
  }

  connectedCallback() {
    super.connectedCallback();
    this.fetchInitialCommits();
    this.setupInfiniteScroll();
    this.setupRefreshInterval();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.teardownInfiniteScroll();
    this.clearRefreshInterval();
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  private async fetchInitialCommits() {
    this.loading = true;
    try {
      const data = await this.commitService.fetchCommits(
        1,
        this.limit,
        new AbortController().signal,
      );
      this.commits = data.commits;
      if (this.commits.length > 0) {
        this.newestCommitId = this.commits[0].id;
      }
      this.hasMore = this.commits.length < data.total_count;
      this.page = 2;
    } catch (e) {
      this.error = e instanceof Error ? e.message : "An unknown error occurred";
    } finally {
      this.loading = false;
    }
  }

  private async fetchCommits() {
    if (this.loading || !this.hasMore) return;

    this.loading = true;
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    try {
      const data = await this.commitService.fetchCommits(
        this.page,
        this.limit,
        this.abortController.signal,
      );
      const newCommits = data.commits.map((commit) => ({
        ...commit,
        isNew: false,
      }));
      this.commits = [...this.commits, ...newCommits];
      this.hasMore = this.commits.length < data.total_count;
      this.page++;
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        this.error =
          e instanceof Error ? e.message : "An unknown error occurred";
      }
    } finally {
      this.loading = false;
    }
  }

  private async refreshCommits() {
    if (this.loading) return;

    if (this.abortController) {
      this.abortController.abort();
    }

    this.abortController = new AbortController();
    this.loading = true;

    try {
      const data = await this.commitService.fetchCommits(
        1,
        this.limit,
        this.abortController.signal,
      );
      this.updateCommits(data.commits);
      this.hasMore = this.commits.length < data.total_count;
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        this.error =
          e instanceof Error ? e.message : "An unknown error occurred";
      }
    } finally {
      this.loading = false;
    }
  }

  private updateCommits(newCommits: Commit[]) {
    if (newCommits.length === 0) return;

    const updatedCommits = [...this.commits];
    let newCommitsAdded = 0;

    for (const commit of newCommits) {
      if (!this.newestCommitId || commit.id !== this.newestCommitId) {
        updatedCommits.unshift({ ...commit, isNew: true });
        newCommitsAdded++;
      } else {
        break;
      }
    }

    if (newCommitsAdded > 0) {
      this.commits = updatedCommits;
      this.newestCommitId = this.commits[0].id;

      setTimeout(() => {
        this.commits = this.commits.map((commit, index) => ({
          ...commit,
          isNew: index < newCommitsAdded ? false : commit.isNew,
        }));
      }, 500);
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
        <div class="commit-header starship-style">
          <span class="user">brice</span>
          <span class="separator">in</span>
          ${commit.is_private
            ? html`<sl-icon
                name="lock-fill"
                title="Private repository"
              ></sl-icon>`
            : ""}
          <a
            href=${commit.url}
            target="_blank"
            rel="noopener noreferrer"
            class="repo ${commit.is_private ? "private-blur" : ""}"
          >
            <sl-icon name="github"></sl-icon>
            ${commit.repo_name}
          </a>
          <span class="timestamp"
            >${this.formatTimestamp(commit.timestamp)}</span
          >
        </div>
        <p class="${commit.is_private ? "private-blur" : ""}">
          ${this.formatCommitMessage(commit.message)}
        </p>
      </li>
    `;
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

    .private-blur {
      filter: blur(2px);
    }

    .commit-header sl-icon[name="lock"] {
      margin-right: 0.5em;
      color: var(--muted-color);
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
      color: var(--repo-color);
      display: flex;
      align-items: center;
    }
    .starship-style sl-icon {
      margin-right: 0.3em;
    }

    .starship-style .timestamp {
      margin-left: auto;
      color: var(--muted-color);
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
