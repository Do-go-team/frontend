import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ko from "./locales/ko.json";

i18n.use(initReactI18next).init({
	lng: "ko",
	fallbackLng: "ko",
	resources: {
		ko: { translation: ko },
	},
	interpolation: {
		escapeValue: false, // React handles XSS
	},
});

export default i18n;
