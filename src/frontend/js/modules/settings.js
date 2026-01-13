
import { state } from '../state.js';
import { Api } from '../api.js';
import { t, showToast } from '../utils.js';

export const Settings = {
	// Called once on App Init
	initGlobal() {
		this.applyTheme(state.theme);
		this.applyLanguage(state.currentLanguage);
		this.loadSettings(); // Fetch rates etc in background
	},

	// Called when View is Loaded
	init() {
		this.bindEvents();
		// Re-apply to ensure UI elements match state
		const langSelector = document.getElementById('language-selector');
		const themeSelector = document.getElementById('theme-selector');
		const rateInput = document.getElementById('exchange-rate-input');

		if (langSelector) langSelector.value = state.currentLanguage;
		if (themeSelector) themeSelector.value = state.theme;
		if (rateInput && state.settings.exchange_rate_usd_vnd) {
			rateInput.value = state.settings.exchange_rate_usd_vnd;
		}
	},

	bindEvents() {
		const langSelector = document.getElementById('language-selector');
		const themeSelector = document.getElementById('theme-selector');
		const updateRateBtn = document.getElementById('update-rate-btn');

		if (langSelector) {
			langSelector.addEventListener('change', (e) => {
				this.handleLanguageChange(e.target.value);
			});
		}

		if (themeSelector) {
			themeSelector.addEventListener('change', (e) => {
				this.handleThemeChange(e.target.value);
			});
		}

		if (updateRateBtn) {
			const rateInput = document.getElementById('exchange-rate-input');
			updateRateBtn.addEventListener('click', () => {
				const rate = rateInput.value;
				if (rate) this.updateExchangeRate(rate);
			});
		}
	},

	async loadSettings() {
		try {
			const settings = await Api.getSettings();
			state.settings = settings;
			// If view is active, update input
			const rateInput = document.getElementById('exchange-rate-input');
			if (rateInput && settings.exchange_rate_usd_vnd) {
				rateInput.value = settings.exchange_rate_usd_vnd;
			}
		} catch (e) {
			console.error('Failed to load settings', e);
		}
	},

	handleLanguageChange(lang) {
		state.currentLanguage = lang;
		localStorage.setItem('parfin_language', lang);
		this.applyLanguage(lang);
		document.dispatchEvent(new Event('settings:updated'));
		this.updateUIText();
	},

	handleThemeChange(theme) {
		state.theme = theme;
		localStorage.setItem('parfin_theme', theme);
		this.applyTheme(theme);
	},

	applyTheme(theme) {
		const root = document.documentElement;
		if (theme === 'dark') {
			root.setAttribute('data-theme', 'dark');
		} else if (theme === 'light') {
			root.setAttribute('data-theme', 'light');
		} else {
			if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
				root.setAttribute('data-theme', 'dark');
			} else {
				root.setAttribute('data-theme', 'light');
			}
		}
	},

	applyLanguage(lang) {
		this.updateUIText();
	},

	updateUIText() {
		document.querySelectorAll('[data-i18n]').forEach(el => {
			const key = el.dataset.i18n;
			el.textContent = t(key);
		});
		document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
			const key = el.dataset.i18nPlaceholder;
			el.placeholder = t(key);
		});
	},

	async updateExchangeRate(rate) {
		try {
			await Api.updateSettings({ 'exchange_rate_usd_vnd': rate });
			state.settings.exchange_rate_usd_vnd = rate;
			showToast(t('toast_save_success'), 'success');
			document.dispatchEvent(new Event('settings:updated'));
		} catch (e) {
			showToast(t('toast_error'), 'error');
		}
	}
};
