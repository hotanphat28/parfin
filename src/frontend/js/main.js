
import { Auth } from './modules/auth.js';
import { Nav } from './modules/nav.js';
import { Transactions } from './modules/transactions.js';
import { Investments } from './modules/investments.js';
import { Settings } from './modules/settings.js';
import { FixedItems } from './modules/fixed_items.js';

document.addEventListener('DOMContentLoaded', () => {
	console.log('App initializing...');
	Settings.initGlobal(); // Apply Theme/Language immediately
	Auth.init();
	Nav.init();
	Transactions.init(); // Initialize listeners
	FixedItems.init();
});

// Coordinate View Loading
document.addEventListener('view:loaded', (e) => {
	console.log('View loaded:', e.detail.viewId);
	const viewId = e.detail.viewId;

	if (viewId === 'view-monthly') {
		Transactions.onViewLoaded();
	}
	else if (viewId === 'view-investment') {
		Investments.init();
	}
	else if (viewId === 'view-settings') {
		Settings.init();
	}

	// Ensure new content is translated
	Settings.updateUIText();
});

document.addEventListener('modals:loaded', () => {
	console.log('Modals loaded');
	Settings.updateUIText();
});

// On Login Success, restore the view
document.addEventListener('auth:login_success', () => {
	Nav.restoreActiveView();
});
