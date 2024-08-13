import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

interface Post {
  id: number;
  title: string;
  content: string;
}

@customElement("post-list")
export class PostList extends LitElement {
  @state() private posts: Post[] = [];
  @state() private loading = true;
  @state() private error: string | null = null;
  @state() private expandedPostId: number | null = null;

  private apiUrl = import.meta.env.VITE_API_URL;

  connectedCallback() {
    super.connectedCallback();
    this.fetchPosts();
  }

  async fetchPosts() {
    try {
      const response = await fetch(`${this.apiUrl}/posts`);
      if (!response.ok) throw new Error("Failed to fetch posts");
      this.posts = await response.json();
      this.loading = false;
    } catch (e) {
      this.error = e instanceof Error ? e.message : "An unknown error occurred";
      this.loading = false;
    }
  }

  togglePost(postId: number) {
    this.expandedPostId = this.expandedPostId === postId ? null : postId;
  }

  render() {
    if (this.loading) {
      return html`<p>Loading posts...</p>`;
    }
    if (this.error) {
      return html`<p>Error: ${this.error}</p>`;
    }
    return html`
      <h1>Posts</h1>
      <ul>
        ${this.posts.map(
          (post) => html`
            <li>
              <h2 @click=${() => this.togglePost(post.id)}>${post.title}</h2>
              ${this.expandedPostId === post.id
                ? html`<p>${post.content}</p>`
                : null}
            </li>
          `,
        )}
      </ul>
    `;
  }

  static styles = css`
    :host {
      display: block;
      font-family: sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
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
      cursor: pointer;
    }
    h2:hover {
      text-decoration: underline;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "post-list": PostList;
  }
}
