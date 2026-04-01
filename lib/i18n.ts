import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import en from '../locales/en.json';

const resources = {
  en: {
    translation: en,
  },
};

// Detect device locale, fall back to 'en'
function detectDeviceLanguage(): string {
  try {
    const locales = Localization.getLocales();
    if (locales && locales.length > 0) {
      const tag = locales[0].languageTag ?? '';
      const lang = tag.split('-')[0].toLowerCase();
      if (lang in resources) {
        return lang;
      }
    }
  } catch {
    // ignore
  }
  return 'en';
}

i18n.use(initReactI18next).init({
  resources,
  lng: detectDeviceLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already guards against XSS
  },
});

export default i18n;
