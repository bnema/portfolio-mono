import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

interface Post {
  id: number;
  title: string;
  body: string;
}

@customElement("post-list")
export class PostList extends LitElement {
  @state() private posts: Post[] = [];
  @state() private loading = true;
  @state() private error: string | null = null;

  private apiUrl = import.meta.env.VITE_API_URL;
  private static token = import.meta.env.VITE_JWT_TOKEN;

  connectedCallback() {
    super.connectedCallback();
    this.fetchPosts();
  }

  async fetchPosts() {
    try {
      const response = await fetch(`${this.apiUrl}/posts`, {
        headers: {
          Authorization: `Bearer ${PostList.token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch posts");

      this.posts = await response.json();
      this.loading = false;
    } catch (e) {
      this.error = e instanceof Error ? e.message : "An unknown error occurred";
      this.loading = false;
    }
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
              <h2>${post.title}</h2>
              <p>${post.body}</p>
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
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "post-list": PostList;
  }
}
