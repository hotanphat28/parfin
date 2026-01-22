
export const state = {
	currentUser: null,
	transactions: [],
	investments: [], // Investment transactions
	filterParams: { period: 'this_month' },
	theme: localStorage.getItem('parfin_theme') || 'system',
	currentLanguage: localStorage.getItem('parfin_language') || 'en',
	chart: null,
	fixedItems: [],
	balances: {}, // Stores current balance state { total, saving, ... } with cash/bank split
	settings: {}, // Stores exchange rates, etc.
	sortParams: { field: 'date', direction: 'desc' } // Default sort: Date Newest
};
