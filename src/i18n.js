import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

if (!i18n.isInitialized) {
  i18n
    .use(HttpBackend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      supportedLngs: ['en', 'sq'],
      nonExplicitSupportedLngs: true,
      fallbackLng: 'en',
      ns: ["common", "navbar", "login", "register", "shoplist", "profile", "shopdetails", "productdetail", "footer", "notifications", "about", "terms", "privacy", "settings", "businessinfo", "productpanel", "sales", "categories", "photos", "employees", "changes", "reservations", "myshops", "deletebusiness", "becomeOwner"],
      defaultNS: 'common',
      load: 'languageOnly',
      lowerCaseLng: true,
      cleanCode: true,
      initImmediate: false, // avoids race on first render
      backend: { loadPath: '/locales/{{lng}}/{{ns}}.json' },
      detection: {
        order: ['localStorage', 'cookie', 'querystring', 'navigator', 'htmlTag'],
        caches: ['localStorage', 'cookie'],
        lookupQuerystring: 'lng',
      },
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
      returnEmptyString: false,
      debug: process.env.NODE_ENV === 'development',
    });
}

// keep <html lang="..."> in sync
if (typeof document !== 'undefined') {
  const syncHtmlLang = () =>
    (document.documentElement.lang = (i18n.resolvedLanguage || i18n.language || 'en').toLowerCase());
  if (i18n.isInitialized) syncHtmlLang();
  i18n.on('initialized', syncHtmlLang);
  i18n.on('languageChanged', syncHtmlLang);
}

export default i18n;
