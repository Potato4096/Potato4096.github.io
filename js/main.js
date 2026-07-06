let postsData = [];

function initTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  updateToggleIcon(theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateToggleIcon(next);
}

function updateToggleIcon(theme) {
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀' : '☾';
}

async function loadPosts() {
  if (postsData.length) return postsData;
  const resp = await fetch('data/posts.json');
  postsData = await resp.json();
  postsData.sort((a, b) => b.date.localeCompare(a.date));
  return postsData;
}

function renderPostItem(post) {
  const tags = post.tags.map(t => `<span>${t}</span>`).join('');
  return `<li class="post-item" onclick="location.href='post.html?slug=${post.slug}'">
    <div class="post-date">${post.date}</div>
    <div class="post-title"><a href="post.html?slug=${post.slug}">${post.title}</a></div>
    <div class="post-summary">${post.summary}</div>
    ${tags ? `<div class="post-tags">${tags}</div>` : ''}
  </li>`;
}

function setActiveNav(page) {
  document.querySelectorAll('nav a').forEach(a => {
    if (a.dataset.page === page) a.classList.add('active');
  });
}

function getSlug() {
  return new URLSearchParams(location.search).get('slug');
}

async function loadPostContent(slug) {
  const posts = await loadPosts();
  const post = posts.find(p => p.slug === slug);
  if (!post) {
    document.getElementById('post-content').innerHTML = '<p>文章不存在</p>';
    return;
  }
  document.title = post.title + " - Potato's Blog";
  const resp = await fetch(`posts/${slug}.html`);
  const html = await resp.text();
  document.getElementById('post-content').innerHTML = html;
}

function filterPosts(posts, keyword) {
  const kw = keyword.toLowerCase();
  return posts.filter(p =>
    p.title.toLowerCase().includes(kw) ||
    p.summary.toLowerCase().includes(kw) ||
    p.tags.some(t => t.toLowerCase().includes(kw)) ||
    p.category.toLowerCase().includes(kw)
  );
}
