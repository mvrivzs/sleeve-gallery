// Simple EN/ES translation toggle
const translations = {
  en: {
    tagline: "A curated cover art gallery",
    submitCover: "Submit a Cover",
    filters: "Filters",
    signIn: "Sign In",
    signOut: "Sign Out",
    myProfile: "My Profile",
    curatorPanel: "Curator Panel",
    featuredCover: "Featured cover",
    swipeHint: "Swipe left/right to browse",
    album: "Album",
    artist: "Artist",
    yearLabel: "Year · Label",
    moreCoversThumbs: "More covers",
    buyVinyl: "Buy Vinyl",
    saveCollection: "Save to Collection",
    saved: "Saved",
    search: "Search",
    genre: "Genre",
    decade: "Decade",
    coverArtRole: "Cover art role",
    clearAll: "Clear all",
    noResults: "No covers match your current filters.",
    introText: "Every great album begins with its cover, a portal into the sonic world within. Here we celebrate the designers, illustrators, and photographers who shaped how we see music.",
    footer: "Sleeve — Cover art gallery concept. All artwork credited to original designers.",
    // Auth modal
    signIn: "Sign In",
    authSubtitle: "Sign in to submit covers, save favorites, and connect with other collectors.",
    continueGoogle: "Continue with Google",
    continueSpotify: "Continue with Spotify",
    // Submit modal
    submitTitle: "Submit a Cover",
    spotifyUrlLabel: "Spotify Album URL or ID",
    fetch: "Fetch",
    musicianLabel: "Musician / Band",
    contributors: "Contributors",
    addContributor: "+ Add contributor",
    year: "Year",
    label: "Label",
    genres: "Genre(s)",
    curatorNoteLabel: "Curator Note (optional)",
    curatorNotePlaceholder: "Why does this cover deserve a spot in the gallery?",
    uploadCover: "Upload Cover",
    submitHint: "Your submission will be reviewed by our curators.",
    submitSuccess: "Cover submitted successfully!",
    submitSuccessHint: "Our curators will review your submission and add it to the gallery if approved. Thank you for contributing!",
    genrePlaceholder: "e.g. Rock, Electronic (comma-separated)",
    checkVinyl: "Check vinyl availability",
    skipToMain: "Skip to main content"
  },
  es: {
    tagline: "Una galería curada de portadas de discos",
    submitCover: "Enviar portada",
    filters: "Filtros",
    logIn: "Iniciar sesión",
    signOut: "Cerrar sesión",
    myProfile: "Mi perfil",
    curatorPanel: "Panel de curador",
    featuredCover: "Portada destacada",
    swipeHint: "Desliza para explorar",
    album: "Álbum",
    artist: "Artista",
    yearLabel: "Año · Sello",
    moreCoversThumbs: "Más portadas",
    buyVinyl: "Comprar vinilo",
    saveCollection: "Guardar en colección",
    saved: "Guardado",
    search: "Buscar",
    genre: "Género",
    decade: "Década",
    coverArtRole: "Rol artístico",
    clearAll: "Borrar todo",
    noResults: "No hay portadas que coincidan con tus filtros.",
    introText: "Todo gran álbum comienza con su portada, un portal al mundo sonoro interior. Aquí celebramos a los diseñadores, ilustradores y fotógrafos que moldearon cómo vemos la música.",
    footer: "Sleeve — Concepto de galería de portadas. Todo el arte acreditado a los diseñadores originales.",
    // Auth modal
    signIn: "Iniciar sesión",
    authSubtitle: "Inicia sesión para enviar portadas, guardar favoritos y conectar con otros coleccionistas.",
    continueGoogle: "Continuar con Google",
    continueSpotify: "Continuar con Spotify",
    // Submit modal
    submitTitle: "Enviar una portada",
    spotifyUrlLabel: "URL o ID del álbum en Spotify",
    fetch: "Buscar",
    musicianLabel: "Músico / Banda",
    contributors: "Contribuidores",
    addContributor: "+ Añadir contribuidor",
    year: "Año",
    label: "Sello",
    genres: "Género(s)",
    curatorNoteLabel: "Nota del curador (opcional)",
    curatorNotePlaceholder: "¿Por qué esta portada merece un lugar en la galería?",
    uploadCover: "Subir portada",
    submitHint: "Tu envío será revisado por nuestros curadores.",
    submitSuccess: "¡Portada enviada correctamente!",
    submitSuccessHint: "Nuestros curadores revisarán tu envío y lo añadirán a la galería si es aprobado. ¡Gracias por contribuir!",
    genrePlaceholder: "ej. Rock, Electrónica (separados por coma)",
    checkVinyl: "Buscar disponibilidad de vinilo",
    skipToMain: "Ir al contenido principal"
  }
};

let currentLang = localStorage.getItem('sleeve-lang') || 'en';

export function t(key) {
  return translations[currentLang]?.[key] || translations.en[key] || key;
}

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('sleeve-lang', lang);
  applyTranslations();
}

export function toggleLang() {
  setLang(currentLang === 'en' ? 'es' : 'en');
}

function applyTranslations() {
  // Update all elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });

  // Update all elements with data-i18n-placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });

  // Update all elements with data-i18n-aria
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });

  // Update all lang toggle buttons
  document.querySelectorAll('#langToggle, #mobileLangToggle').forEach(btn => {
    btn.textContent = currentLang === 'en' ? 'ES' : 'EN';
  });

  // Update html lang
  document.documentElement.lang = currentLang;
}

export function initI18n() {
  // Apply saved language
  applyTranslations();

  // Lang toggle buttons (pre-menu + mobile)
  document.querySelectorAll('#langToggle, #mobileLangToggle').forEach(btn => {
    btn.addEventListener('click', toggleLang);
  });
}
