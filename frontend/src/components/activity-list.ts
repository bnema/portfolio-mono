// src/components/activity-list.ts
import { LitElement, html, css } from "lit";
import { customElement, state, query } from "lit/decorators.js";
import { formatDistanceToNow } from "date-fns";
import { Activity } from "../types/activity";
import { CommitService } from "../services/commit-service";
import { ActivityService } from "../services/activity-service";

@customElement("activity-list")
export class ActivityList extends LitElement {
  @state() private activities: Activity[] = [];
  @state() private loading = false;
  @state() private error: string | null = null;
  @state() private page = 1;
  @state() private hasMore = true;

  @query("#sentinel") private sentinel!: HTMLElement;

  private services: ActivityService[];
  private intersectionObserver!: IntersectionObserver;
  private limit = 10;
  constructor() {
    super();
    const apiUrl = import.meta.env.VITE_API_URL as string;
    this.services = [
      new CommitService(apiUrl),
      // TODO: Add more services here
    ];
  }

  connectedCallback() {
    super.connectedCallback();
    this.setupIntersectionObserver();
    this.fetchActivities();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.intersectionObserver.disconnect();
  }

  private setupIntersectionObserver() {
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && this.hasMore && !this.loading) {
          this.loadMore();
        }
      },
      { threshold: 0.1 },
    );
  }

  firstUpdated() {
    if (this.sentinel) {
      this.intersectionObserver.observe(this.sentinel);
    }
  }

  private async fetchActivities(loadMore = false) {
    if (this.loading || (!loadMore && this.activities.length > 0)) return;

    this.loading = true;
    this.error = null;

    try {
      const activitiesPromises = this.services.map((service) =>
        service.fetchActivities(this.limit, this.page),
      );
      const activitiesArrays = await Promise.all(activitiesPromises);
      const newActivities = activitiesArrays
        .flat()
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );

      if (loadMore) {
        this.activities = [...this.activities, ...newActivities];
      } else {
        this.activities = newActivities;
      }

      this.hasMore = newActivities.length === this.limit;
      this.page++;
    } catch (e) {
      this.error = e instanceof Error ? e.message : "An unknown error occurred";
    } finally {
      this.loading = false;
    }
  }

  private loadMore() {
    this.fetchActivities(true);
  }

  render() {
    return html`
      <h1>Latest activity</h1>
      ${this.error ? html`<p class="error">Error: ${this.error}</p>` : ""}
      <ul>
        ${this.activities.map((activity) => this.renderActivity(activity))}
      </ul>
      ${this.loading ? html`<p>Loading activities...</p>` : ""}
      <div id="sentinel"></div>
      ${this.hasMore && !this.loading
        ? html` <button @click=${this.loadMore}>Load More</button> `
        : ""}
    `;
  }

  private renderActivity(activity: Activity) {
    return html`
      <li>
        <div class="activity-header starship-style">
          <span class="user">brice</span>
          <span class="separator">in</span>
          ${activity.isPrivate
            ? html`<sl-icon
                name="lock-fill"
                title="Private activity"
              ></sl-icon>`
            : ""}
          <a
            href=${activity.url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            class="activity-link ${activity.isPrivate ? "private-blur" : ""}"
          >
            <sl-icon
              name=${this.getIconForActivityType(activity.type)}
            ></sl-icon>
            ${this.getActivityTypeLabel(activity.type)}
            ${activity.type === "commit" && activity.metadata?.repoName
              ? html` - ${activity.metadata.repoName}`
              : ""}
          </a>
          <span class="timestamp"
            >${this.formatTimestamp(activity.timestamp)}</span
          >
        </div>
        <p class="${activity.isPrivate ? "private-blur" : ""}">
          ${this.formatActivityContent(activity.content)}
        </p>
      </li>
    `;
  }

  private getIconForActivityType(type: string): string {
    switch (type) {
      case "commit":
        return "github";
      case "tweet":
        return "twitter";
      default:
        return "activity";
    }
  }

  private getActivityTypeLabel(type: string): string {
    switch (type) {
      case "commit":
        return "GitHub";
      case "tweet":
        return "Twitter";
      default:
        return "Activity";
    }
  }

  private formatActivityContent(content: string) {
    return content
      .split("\n")
      .map((line) =>
        line.trim().startsWith("-")
          ? html`<span class="indented">${line}</span><br />`
          : html`${line}<br />`,
      );
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

    .activity-header sl-icon[name="lock-fill"] {
      margin-right: 0.5em;
      color: var(--muted-color);
    }

    .indented {
      padding-left: 0.5em;
    }

    .activity-header {
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

    .starship-style .activity-link {
      color: var(--activity-color);
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

    button {
      background-color: var(--button-bg-color, #4a4a4a);
      color: var(--button-text-color, white);
      border: none;
      padding: 10px 20px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 1em;
      margin-top: 1em;
    }

    button:hover {
      background-color: var(--button-hover-bg-color, #5a5a5a);
    }

    .error {
      color: var(--error-color, red);
      font-weight: bold;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "activity-list": ActivityList;
  }
}
