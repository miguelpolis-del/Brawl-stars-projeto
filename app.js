
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// CONFIGURAÇÃO FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyDV2LIAiYJRNgzKG_AyGqoNbvYdIIaDc78",
  authDomain: "brawlhub-5e54b.firebaseapp.com",
  projectId: "brawlhub-5e54b",
  storageBucket: "brawlhub-5e54b.firebasestorage.app",
  messagingSenderId: "486617513112",
  appId: "1:486617513112:web:4523a67b28b82a7b7824ed"
};

const configured = !Object.values(firebaseConfig).some(
  value => String(value).startsWith("COLE_") ||
           String(value).startsWith("SEU_")
);

let auth = null;
let db = null;

if (configured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  console.warn("Configure o Firebase para ativar login e anúncios.");
}

// ELEMENTOS
const $ = selector => document.querySelector(selector);

const authModal = $("#authModal");
const listingModal = $("#listingModal");

let currentUser = null;
let registering = false;
let activeFilter = "Todos";
let allListings = [];

// MODAIS
function show(element) {
  if (element) element.classList.remove("hidden");
}

function hide(element) {
  if (element) element.classList.add("hidden");
}

// MENU
$("#menuBtn")?.addEventListener("click", () => {
  $("#menuPanel")?.classList.toggle("hidden");
});

document.addEventListener("click", event => {
  if (!event.target.closest(".topbar")) {
    $("#menuPanel")?.classList.add("hidden");
  }
});

// TEMA
$("#themeToggle")?.addEventListener("click", () => {
  document.body.classList.toggle("dark");

  localStorage.setItem(
    "brawlhub-theme",
    document.body.classList.contains("dark") ? "dark" : "light"
  );
});

if (localStorage.getItem("brawlhub-theme") === "dark") {
  document.body.classList.add("dark");
}

// FECHAR MODAIS
document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => {
    hide(document.getElementById(button.dataset.close));
  });
});

[authModal, listingModal].forEach(modal => {
  modal?.addEventListener("click", event => {
    if (event.target === modal) hide(modal);
  });
});

// LOGIN
function openAuth() {
  registering = false;
  renderAuthMode();
  show(authModal);
}

$("#loginOpen")?.addEventListener("click", openAuth);

// ALTERNAR LOGIN E CADASTRO
function renderAuthMode() {
  $("#authTitle").textContent = registering ? "Criar conta" : "Entrar";

  $("#authSubmit").textContent = registering
    ? "Criar minha conta"
    : "Entrar";

  $("#authSwitch").innerHTML = registering
    ? 'Já tem conta? <button type="button">Entrar</button>'
    : 'Não tem conta? <button type="button">Criar conta</button>';

  $("#authSwitch").querySelector("button").onclick = () => {
    registering = !registering;
    renderAuthMode();
  };
}

// AUTENTICAÇÃO
$("#authForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!configured) {
    alert("Configure o Firebase no app.js primeiro.");
    return;
  }

  const email = $("#authEmail").value.trim();
  const password = $("#authPassword").value;

  try {
    if (registering) {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }

    hide(authModal);

  } catch (error) {
    alert("Erro no login: " + friendlyError(error.code));
  }
});

function friendlyError(code) {
  const errors = {
    "auth/email-already-in-use": "Este e-mail já está cadastrado.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/weak-password": "Use uma senha com pelo menos 6 caracteres.",
    "auth/invalid-email": "E-mail inválido.",
    "auth/network-request-failed": "Verifique sua conexão."
  };

  return errors[code] || code;
}

// ESTADO DO USUÁRIO
if (configured) {
  onAuthStateChanged(auth, user => {
    currentUser = user;

    $("#loginOpen").textContent = user ? "Minha conta" : "Entrar";

    $("#logoutBtn")?.classList.toggle("hidden", !user);
  });

  $("#logoutBtn")?.addEventListener("click", async () => {
    await signOut(auth);
  });
}

// BOTÃO ANUNCIAR
function openListing() {
  if (!currentUser) {
    openAuth();
    return;
  }

  show(listingModal);
}

$("#publishOpen")?.addEventListener("click", openListing);
$("#heroPublish")?.addEventListener("click", openListing);

// PUBLICAR ANÚNCIO
$("#listingForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!configured || !currentUser) {
    alert("Faça login e configure o Firebase.");
    return;
  }

  const phone = $("#listingPhone").value.trim();
  const instagram = $("#listingInstagram").value.trim();

  if (!phone && !instagram) {
    alert("Informe telefone ou Instagram.");
    return;
  }

  const item = {
    title: $("#listingTitle").value.trim(),
    category: $("#listingCategory").value,
    price: Number($("#listingPrice").value),
    description: $("#listingDescription").value.trim(),
    phone,
    instagram: instagram.replace(/^@/, ""),
    sellerId: currentUser.uid,
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "listings"), item);

    event.target.reset();
    hide(listingModal);

    await loadListings();

    alert("Anúncio publicado!");

  } catch (error) {
    alert("Erro ao publicar: " + error.message);
  }
});

// SEGURANÇA DO HTML
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

// MOSTRAR ANÚNCIOS
function render() {
  const term = ($("#searchInput")?.value || "").toLowerCase();

  const rows = allListings.filter(item => {
    const matchesFilter =
      activeFilter === "Todos" || item.category === activeFilter;

    const matchesSearch =
      `${item.title} ${item.description}`.toLowerCase().includes(term);

    return matchesFilter && matchesSearch;
  });

  $("#listingGrid").innerHTML = rows.length
    ? rows.map(item => {
        const wa = item.phone
          ? `https://wa.me/${item.phone.replace(/\D/g, "")}`
          : "";

        const ig = item.instagram
          ? `https://instagram.com/${encodeURIComponent(item.instagram.replace(/^@/, ""))}`
          : "";

        return `
          <article class="listing">
            <div class="listing-banner">★</div>

            <div class="listing-body">
              <div class="listing-meta">
                <span class="category-pill">
                  ${escapeHtml(item.category)}
                </span>
                <span>BRAWLHUB</span>
              </div>

              <h3>${escapeHtml(item.title)}</h3>

              <p>${escapeHtml(item.description)}</p>

              <div class="price">
                ${Number(item.price || 0).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL"
                })}
              </div>

              <div class="listing-actions">
                ${wa ? `<a class="contact-btn" target="_blank" rel="noopener" href="${wa}">WhatsApp</a>` : ""}
                ${ig ? `<a class="contact-btn" target="_blank" rel="noopener" href="${ig}">Instagram</a>` : ""}
              </div>
            </div>
          </article>
        `;
      }).join("")
    : '<div class="empty-state">Nenhum anúncio encontrado. Que tal publicar o primeiro?</div>';
}

// CARREGAR ANÚNCIOS
async function loadListings() {
  if (!configured) {
    $("#listingGrid").innerHTML =
      '<div class="empty-state">Configure o Firebase para carregar anúncios.</div>';
    return;
  }

  try {
    const snapshot = await getDocs(
      query(
        collection(db, "listings"),
        orderBy("createdAt", "desc")
      )
    );

    allListings = snapshot.docs.map(document => ({
      id: document.id,
      ...document.data()
    }));

    render();

  } catch (error) {
    $("#listingGrid").innerHTML =
      '<div class="empty-state">Não foi possível carregar os anúncios. Confira as regras do Firestore.</div>';

    console.error(error);
  }
}

// FILTROS
document.querySelectorAll(".filter").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach(element => {
      element.classList.remove("active");
    });

    button.classList.add("active");
    activeFilter = button.dataset.filter;

    render();
  });
});

// PESQUISA
$("#searchInput")?.addEventListener("input", render);

// INICIALIZAÇÃO
loadListings();
