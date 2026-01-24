import { state } from './state.js';
import { translations } from './translations.js';

export function t(key) {
	const lang = state.currentLanguage;
	if (translations[lang] && translations[lang][key]) {
		return translations[lang][key];
	}
	return key; // Fallback
}

export function convertAmount(amount, fromCurrency = 'VND') {
	const targetCurrency = state.currentLanguage === 'vi' ? 'VND' : 'USD';

	// If same currency, return as is
	if (fromCurrency === targetCurrency) return amount;

	// Get Rate (Default 25000 if not set)
	const rate = parseFloat(state.settings.exchange_rate_usd_vnd) || 25000;

	if (fromCurrency === 'VND' && targetCurrency === 'USD') {
		return amount / rate;
	} else if (fromCurrency === 'USD' && targetCurrency === 'VND') {
		return amount * rate;
	}

	return amount; // Fallback
}

export function formatCurrency(amount, fromCurrency = 'VND') {
	const convertedAmount = convertAmount(amount, fromCurrency);
	const locale = state.currentLanguage === 'vi' ? 'vi-VN' : 'en-US';
	const currency = state.currentLanguage === 'vi' ? 'VND' : 'USD';
	return new Intl.NumberFormat(locale, { style: 'currency', currency: currency }).format(convertedAmount);
}

export function getCategoryIcon(category) {
	const icons = {
		'Food': '🍜',
		'Transport': '🚗',
		'Shopping': '🛍️',
		'Bills': '💡',
		'Rent': '🏠',
		'Utilities': '⚡',
		'Entertainment': '🎬',
		'Health': '💊',
		'Salary': '💰',
		'Transfer': '↔️',
		'Investment': '📈',
		'Saving': '🐖',
		'Debt': '💸',
		'Support': '🤝',
		'Personal': '👤',
		'Together': '👩‍❤️‍👨',
		'Other': '📝'
	};
	return icons[category] || '📝';
}

export function getCategoryName(categoryKey) {
	// return name based on translation key 'category_<lower_key>'
	const key = `category_${categoryKey.toLowerCase()}`;
	return t(key);
}

export function showToast(message, type = 'info') {
	const container = document.getElementById('toast-container');
	if (!container) return; // Should exist

	const toast = document.createElement('div');
	toast.className = 'toast';
	toast.textContent = message;
	if (type === 'error') toast.style.borderColor = 'var(--danger)';
	if (type === 'success') toast.style.borderColor = 'var(--success)';

	container.appendChild(toast);

	setTimeout(() => {
		toast.remove();
	}, 3000);
}
