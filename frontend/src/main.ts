import "./post-list";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  const postList = document.createElement("post-list");
  app.appendChild(postList);
}
