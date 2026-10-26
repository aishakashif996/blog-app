/* Inkwell blog app — front-end only. Data lives in the browser's localStorage. */
const store = {
  get(k, d){ try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch { alert("Storage is full or blocked in this browser."); } }
};
const users = () => store.get("ink_users", []);
const posts = () => store.get("ink_posts", []);
const session = () => store.get("ink_session", null);
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = t => new Date(t).toLocaleDateString(undefined, {year:"numeric", month:"short", day:"numeric"});

// First visit: add sample posts so the home page isn't empty.
if (!localStorage.getItem("ink_posts")) {
  const now = Date.now();
  store.set("ink_posts", [
    {id:"s1", authorId:"seed", author:"Inkwell Team", title:"Welcome to Inkwell", image:"", created:now-86400000*3,
     content:"Inkwell is a small blog you can run from a single folder. Register an account, open your dashboard and write your first post.\n\nEverything is saved in your browser, so there is no server to set up."},
    {id:"s2", authorId:"seed", author:"Inkwell Team", title:"Writing a post people finish reading", image:"", created:now-86400000*2,
     content:"Start with the point. Use short paragraphs. Cut the sentence you like best if it does not help the reader.\n\nRead it aloud once before you publish."},
    {id:"s3", authorId:"seed", author:"Inkwell Team", title:"Adding a cover image", image:"", created:now-86400000,
     content:"On the Create Blog page, paste a link to any image. Leave it empty and the post gets a colour cover instead."}
  ]);
}

// Shared header + footer
function renderChrome(){
  const user = session(), page = document.body.dataset.page;
  const link = (href, label, key) => `<a href="${href}"${page === key ? ' aria-current="page"' : ""}>${label}</a>`;
  const nav = user
    ? link("index.html","Home","home") + link("dashboard.html","Dashboard","dashboard") + link("create-blog.html","Create Blog","create") + `<button id="logout" type="button">Log out</button>`
    : link("index.html","Home","home") + link("login.html","Log in","login") + link("register.html","Register","register");
  document.body.insertAdjacentHTML("afterbegin",
    `<header class="site-header"><div class="bar"><a class="brand" href="index.html">Ink<span>well</span></a><nav class="nav" aria-label="Main">${nav}</nav></div></header>`);
  document.body.insertAdjacentHTML("beforeend", `<footer>&copy; ${new Date().getFullYear()} Inkwell. Built with HTML, CSS and JavaScript.</footer>`);
  $("#logout")?.addEventListener("click", () => { localStorage.removeItem("ink_session"); location.href = "index.html"; });
}

function requireLogin(){
  if (!session()) { location.replace("login.html?next=" + encodeURIComponent(location.pathname.split("/").pop() + location.search)); return false; }
  return true;
}

function cardHTML(p, mine){
  const cover = p.image ? `style="background-image:url('${esc(p.image)}')"` : "";
  const excerpt = p.content.length > 140 ? p.content.slice(0, 140).trim() + "…" : p.content;
  const actions = mine
    ? `<a class="btn small ghost" href="create-blog.html?id=${p.id}">Edit</a><button class="btn small danger" data-del="${p.id}" type="button">Delete</button>`
    : `<button class="btn small ghost" data-read="${p.id}" type="button">Read post</button>`;
  return `<article class="post"><div class="cover" ${cover} role="img" aria-label="Cover for ${esc(p.title)}"></div>
    <div class="body"><div class="meta">${esc(p.author)} · ${fmt(p.created)}</div><h3>${esc(p.title)}</h3><p>${esc(excerpt)}</p><div class="actions">${actions}</div></div></article>`;
}

/* ---------- pages ---------- */
const pages = {
  home(){
    const grid = $("#grid"), search = $("#search"), dlg = $("#reader");
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const list = posts().filter(p => !q || (p.title + p.content + p.author).toLowerCase().includes(q)).sort((a,b) => b.created - a.created);
      grid.innerHTML = list.length ? list.map(p => cardHTML(p, false)).join("") : `<div class="empty">No posts match your search.</div>`;
    };
    search.addEventListener("input", draw); draw();
    grid.addEventListener("click", e => {
      const id = e.target.dataset.read; if (!id) return;
      const p = posts().find(x => x.id === id);
      $("#reader-body").innerHTML = `<h2>${esc(p.title)}</h2><div class="meta">${esc(p.author)} · ${fmt(p.created)}</div><p class="full">${esc(p.content)}</p>`;
      dlg.showModal();
    });
    $("#close-reader").addEventListener("click", () => dlg.close());
  },

  register(){
    $("#form").addEventListener("submit", e => {
      e.preventDefault();
      const name = $("#name").value.trim(), email = $("#email").value.trim().toLowerCase(), pw = $("#password").value, err = $("#err");
      if (name.length < 2) return err.textContent = "Enter your name (at least 2 letters).";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err.textContent = "Enter a valid email address.";
      if (pw.length < 6) return err.textContent = "Use a password with at least 6 characters.";
      if (pw !== $("#confirm").value) return err.textContent = "The two passwords do not match.";
      const all = users();
      if (all.some(u => u.email === email)) return err.textContent = "An account with this email already exists. Try logging in.";
      const user = {id:"u" + Date.now(), name, email, pw};
      store.set("ink_users", [...all, user]);
      store.set("ink_session", {id:user.id, name:user.name});
      location.href = "dashboard.html";
    });
  },

  login(){
    $("#form").addEventListener("submit", e => {
      e.preventDefault();
      const email = $("#email").value.trim().toLowerCase(), pw = $("#password").value;
      const u = users().find(x => x.email === email && x.pw === pw);
      if (!u) return $("#err").textContent = "Email or password is incorrect.";
      store.set("ink_session", {id:u.id, name:u.name});
      const next = new URLSearchParams(location.search).get("next");
      location.href = next && /^[\w.-]+\.html/.test(next) ? next : "dashboard.html";
    });
  },

  dashboard(){
    if (!requireLogin()) return;
    const me = session(), grid = $("#grid");
    $("#welcome").textContent = `Hello, ${me.name}`;
    const draw = () => {
      const mine = posts().filter(p => p.authorId === me.id).sort((a,b) => b.created - a.created);
      $("#count").textContent = mine.length === 1 ? "1 post" : `${mine.length} posts`;
      grid.innerHTML = mine.length ? mine.map(p => cardHTML(p, true)).join("")
        : `<div class="empty">You have not written anything yet.<br><a class="btn" href="create-blog.html" style="margin-top:1rem">Write your first post</a></div>`;
    };
    grid.addEventListener("click", e => {
      const id = e.target.dataset.del;
      if (id && confirm("Delete this post? This cannot be undone.")) { store.set("ink_posts", posts().filter(p => p.id !== id)); draw(); }
    });
    draw();
  },

  create(){
    if (!requireLogin()) return;
    const me = session(), id = new URLSearchParams(location.search).get("id");
    const existing = id && posts().find(p => p.id === id && p.authorId === me.id);
    if (existing) {
      $("#heading").textContent = "Edit blog"; $("#save").textContent = "Save changes";
      $("#title").value = existing.title; $("#image").value = existing.image; $("#content").value = existing.content;
    }
    $("#form").addEventListener("submit", e => {
      e.preventDefault();
      const title = $("#title").value.trim(), image = $("#image").value.trim(), content = $("#content").value.trim(), err = $("#err");
      if (title.length < 3) return err.textContent = "Give your post a title (at least 3 characters).";
      if (image && !/^https?:\/\//i.test(image)) return err.textContent = "The image link must start with http:// or https://";
      if (content.length < 30) return err.textContent = "Write at least 30 characters in the post body.";
      let all = posts();
      if (existing) all = all.map(p => p.id === existing.id ? {...p, title, image, content} : p);
      else all.push({id:"p" + Date.now(), authorId:me.id, author:me.name, title, image, content, created:Date.now()});
      store.set("ink_posts", all);
      location.href = "dashboard.html";
    });
  }
};

document.addEventListener("DOMContentLoaded", () => { renderChrome(); pages[document.body.dataset.page]?.(); });
