import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// 1) Crie um projeto em https://console.firebase.google.com/
// 2) Ative Authentication > Email/Password e crie um Firestore Database.
// 3) Cole aqui a configuração do seu app Web Firebase.
const firebaseConfig = {
  apiKey: "COLE_SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

const configured = !Object.values(firebaseConfig).some(v => String(v).startsWith("COLE_") || String(v).startsWith("SEU_"));
let auth, db;
if (configured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app); db = getFirestore(app);
} else {
  console.warn("Configure o Firebase em app.js para ativar login e anúncios online.");
}

const $ = s => document.querySelector(s);
let currentUser = null, registering = false, activeFilter = "Todos", allListings = [];
const authModal=$("#authModal"), listingModal=$("#listingModal");
function show(el){el.classList.remove("hidden")} function hide(el){el.classList.add("hidden")}
$("#menuBtn").addEventListener("click",()=>$("#menuPanel").classList.toggle("hidden"));
document.addEventListener("click",e=>{if(!e.target.closest(".topbar"))$("#menuPanel").classList.add("hidden")});
$("#themeToggle").addEventListener("click",()=>{document.body.classList.toggle("dark");localStorage.setItem("brawlhub-theme",document.body.classList.contains("dark")?"dark":"light")});
if(localStorage.getItem("brawlhub-theme")==="dark")document.body.classList.add("dark");
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>hide(document.getElementById(b.dataset.close)));
[authModal,listingModal].forEach(m=>m.addEventListener("click",e=>{if(e.target===m)hide(m)}));
function openAuth(){
  if(!configured){alert("Antes, configure o Firebase no arquivo app.js. Veja o README.");return}
  registering = false;
  renderAuthMode();
  show(authModal);
}
$("#loginOpen").onclick=openAuth;
$("#publishOpen").onclick=$("#heroPublish").onclick=()=>{if(!currentUser){openAuth();return}show(listingModal)};
function renderAuthMode(){
  $("#authTitle").textContent=registering?"Criar conta":"Entrar";
  $("#authSubmit").textContent=registering?"Criar minha conta":"Entrar";
  $("#authSwitch").innerHTML=registering?'Já tem conta? <button type="button">Entrar</button>':'Não tem conta? <button type="button">Criar conta</button>';
  function renderAuthMode(){
  $("#authTitle").textContent = registering ? "Criar conta" : "Entrar";
  $("#authSubmit").textContent = registering ? "Criar minha conta" : "Entrar";
  $("#authSwitch").innerHTML = registering
    ? 'Já tem conta? <button type="button">Entrar</button>'
    : 'Não tem conta? <button type="button">Criar conta</button>';
  $("#authSwitch").querySelector("button").onclick = () => {
    registering = !registering;
    renderAuthMode();
  };
}
renderAuthMode();
$("#authForm").addEventListener("submit",async e=>{e.preventDefault();if(!configured)return;const email=$("#authEmail").value.trim(),password=$("#authPassword").value;try{if(registering)await createUserWithEmailAndPassword(auth,email,password);else await signInWithEmailAndPassword(auth,email,password);hide(authModal)}catch(err){alert("Não foi possível autenticar: "+friendlyError(err.code))}});
function friendlyError(code){return ({ "auth/email-already-in-use":"Este e-mail já está cadastrado.","auth/invalid-credential":"E-mail ou senha incorretos.","auth/weak-password":"Use uma senha com pelo menos 6 caracteres.","auth/invalid-email":"E-mail inválido."})[code]||code}
if(configured){onAuthStateChanged(auth,user=>{currentUser=user;$("#loginOpen").textContent=user?"Minha conta":"Entrar";$("#logoutBtn").classList.toggle("hidden",!user)});$("#logoutBtn").onclick=()=>signOut(auth)}
$("#listingForm").addEventListener("submit",async e=>{e.preventDefault();if(!currentUser||!configured)return;const phone=$("#listingPhone").value.trim(),instagram=$("#listingInstagram").value.trim();if(!phone&&!instagram){alert("Informe telefone, Instagram ou os dois.");return}const item={title:$("#listingTitle").value.trim(),category:$("#listingCategory").value,price:Number($("#listingPrice").value),description:$("#listingDescription").value.trim(),phone,instagram:instagram.replace(/^@/,""),sellerId:currentUser.uid,createdAt:serverTimestamp()};try{await addDoc(collection(db,"listings"),item);e.target.reset();hide(listingModal);await loadListings();alert("Anúncio publicado!")}catch(err){alert("Erro ao publicar: "+err.message)}});
function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function render(){const term=$("#searchInput").value.toLowerCase();const rows=allListings.filter(x=>(activeFilter==="Todos"||x.category===activeFilter)&&(`${x.title} ${x.description}`).toLowerCase().includes(term));$("#listingGrid").innerHTML=rows.length?rows.map(x=>{const wa=x.phone?`https://wa.me/${x.phone.replace(/\D/g,"")}`:"";const ig=x.instagram?`https://instagram.com/${encodeURIComponent(x.instagram.replace(/^@/,""))}`:"";return `<article class="listing"><div class="listing-banner">★</div><div class="listing-body"><div class="listing-meta"><span class="category-pill">${escapeHtml(x.category)}</span><span>BRAWLHUB</span></div><h3>${escapeHtml(x.title)}</h3><p>${escapeHtml(x.description)}</p><div class="price">${Number(x.price||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</div><div class="listing-actions">${wa?`<a class="contact-btn" target="_blank" rel="noopener" href="${wa}">WhatsApp</a>`:""}${ig?`<a class="contact-btn" target="_blank" rel="noopener" href="${ig}">Instagram</a>`:""}</div></div></article>`}).join(""):'<div class="empty-state">Nenhum anúncio encontrado. Que tal publicar o primeiro?</div>'}
async function loadListings(){if(!configured){$("#listingGrid").innerHTML='<div class="empty-state">Configure o Firebase para carregar anúncios reais. Veja o README.</div>';return}try{const snap=await getDocs(query(collection(db,"listings"),orderBy("createdAt","desc")));allListings=snap.docs.map(d=>({id:d.id,...d.data()}));render()}catch(e){$("#listingGrid").innerHTML='<div class="empty-state">Não foi possível carregar. Confira as regras do Firestore.</div>';console.error(e)}}
document.querySelectorAll(".filter").forEach(b=>b.onclick=()=>{document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");activeFilter=b.dataset.filter;render()});
$("#searchInput").addEventListener("input",render);
loadListings();
