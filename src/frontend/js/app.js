/**
 * ParFin Application Logic
 */

const App = {
	state: {
		currentUser: null,
		transactions: [],
		filterParams: { type: 'month', month: new Date().toISOString().slice(0, 7) }, // YYYY-MM
		theme: localStorage.getItem('parfin_theme') || 'system',
		currentLanguage: localStorage.getItem('parfin_language') || 'en',
		chart: null,
		fixedItems: [],
		balances: {}, // Stores current balance state { total, saving, ... } with cash/bank split
		settings: {}, // Stores exchange rates, etc.
		sortParams: { field: 'date', direction: 'desc' } // Default sort: Date Newest
	},

	elements: {
		loginView: document.getElementById('login-view'),
		dashboardView: document.getElementById('dashboard-view'),
		loginForm: document.getElementById('login-form'),
		userDisplayName: document.getElementById('user-display-name'),
		logoutBtn: document.getElementById('logout-btn'),
		transactionList: document.getElementById('transaction-list'),
		totalBalance: document.getElementById('total-balance'),
		monthlyIncome: document.getElementById('monthly-income'),
		monthlyExpense: document.getElementById('monthly-expense'),
		totalSaving: document.getElementById('total-saving'),
		savingCash: document.getElementById('saving-cash'),
		savingBank: document.getElementById('saving-bank'),

		totalSupport: document.getElementById('total-support'),
		supportCash: document.getElementById('support-cash'),
		supportBank: document.getElementById('support-bank'),

		totalInvestment: document.getElementById('total-investment'),
		investmentCash: document.getElementById('investment-cash'),
		investmentBank: document.getElementById('investment-bank'),

		totalTogether: document.getElementById('total-together'),
		togetherCash: document.getElementById('together-cash'),
		togetherBank: document.getElementById('together-bank'),

		balanceCash: document.getElementById('balance-cash'),
		balanceBank: document.getElementById('balance-bank'),

		addTransactionBtn: document.getElementById('add-transaction-btn'),
		transactionModal: document.getElementById('transaction-modal'),
		transactionForm: document.getElementById('transaction-form'),
		cancelTransactionBtn: document.getElementById('cancel-transaction-btn'),
		filterType: document.getElementById('filter-type'),
		filterMonth: document.getElementById('filter-month'),
		toastContainer: document.getElementById('toast-container'),
		themeSelector: document.getElementById('theme-selector'),
		languageSelector: document.getElementById('language-selector'),
		transactionListBody: document.getElementById('transaction-list-body'),
		allocationChart: document.getElementById('allocation-chart'),
		// Import/Export Elements
		exportBtn: document.getElementById('export-btn'),
		importBtn: document.getElementById('import-btn'),
		exportModal: document.getElementById('export-modal'),
		importModal: document.getElementById('import-modal'),
		exportForm: document.getElementById('export-form'),
		importForm: document.getElementById('import-form'),
		cancelExportBtn: document.getElementById('cancel-export-btn'),
		cancelImportBtn: document.getElementById('cancel-import-btn'),
		modalTitle: document.getElementById('modal-title'),
		// Fixed Items Elements
		fixedItemsBtn: document.getElementById('fixed-items-btn'),
		fixedItemsModal: document.getElementById('fixed-items-modal'),
		addFixedItemBtn: document.getElementById('add-fixed-item-btn'),
		generateFixedBtn: document.getElementById('generate-fixed-btn'),
		fixedItemsListBody: document.getElementById('fixed-items-list-body'),
		closeFixedModalBtn: document.getElementById('close-fixed-modal-btn'),
		fixedItemFormModal: document.getElementById('fixed-item-form-modal'),
		fixedFormTitle: document.getElementById('fixed-form-title'),
		fixedItemForm: document.getElementById('fixed-item-form'),
		cancelFixedFormBtn: document.getElementById('cancel-fixed-form-btn'),
		// Sidebar Elements
		sidebarToggle: document.getElementById('sidebar-toggle'),
		mainSidebar: document.getElementById('main-sidebar'),
		navItems: document.querySelectorAll('.nav-item'),
		viewSections: document.querySelectorAll('.view-section'),
		sidebarUserName: document.getElementById('sidebar-user-name'),
		// Settings Elements
		exchangeRateInput: document.getElementById('exchange-rate-input'),
		updateRateBtn: document.getElementById('update-rate-btn'),
		// Chart Elements
		chartContainer: document.getElementById('chart-container'),
		toggleChartBtn: document.getElementById('toggle-chart-btn')
	},

	init() {
		this.applyTheme(this.state.theme);
		this.setLanguage(this.state.currentLanguage);
		this.bindEvents();
		this.initSidebar();
		this.checkAuth();
		this.fetchSettings();
	},

	bindEvents() {
		this.elements.loginForm.addEventListener('submit', (e) => this.handleLogin(e));

		if (this.elements.logoutBtn) {
			this.elements.logoutBtn.addEventListener('click', () => this.handleLogout());
		}

		// Sidebar Toggle
		this.elements.sidebarToggle.addEventListener('click', () => {
			this.elements.mainSidebar.classList.toggle('collapsed');
			const isCollapsed = this.elements.mainSidebar.classList.contains('collapsed');
			localStorage.setItem('parfin_sidebar_collapsed', isCollapsed);
		});

		// Navigation
		this.elements.navItems.forEach(item => {
			item.addEventListener('click', (e) => {
				e.preventDefault();
				this.switchView(item);
			});
		});

		this.elements.addTransactionBtn.addEventListener('click', () => {
			this.elements.transactionForm.reset();
			this.elements.transactionForm.querySelector('input[name="id"]').value = '';
			const dateInput = this.elements.transactionForm.querySelector('input[name="date"]');
			if (dateInput) dateInput.valueAsDate = new Date();
			this.elements.modalTitle.textContent = this.t('modal_add_title');

			// Initialize category/destination state for default (Expense)
			this.updateTransactionFormState();

			this.showModal();
		});

		this.elements.cancelTransactionBtn.addEventListener('click', () => this.hideModal());
		this.elements.transactionForm.addEventListener('submit', (e) => this.handleTransactionSubmit(e));

		// Transaction Form Type Change
		const transactionTypeRadios = this.elements.transactionForm.querySelectorAll('input[name="type"]');
		transactionTypeRadios.forEach(radio => {
			radio.addEventListener('change', () => this.updateTransactionFormState());
		});

		// Import/Export Events
		this.elements.exportBtn.addEventListener('click', () => {
			this.elements.exportModal.classList.remove('hidden');
		});
		this.elements.importBtn.addEventListener('click', () => {
			this.elements.importModal.classList.remove('hidden');
		});
		this.elements.cancelExportBtn.addEventListener('click', () => {
			this.elements.exportModal.classList.add('hidden');
		});
		this.elements.cancelImportBtn.addEventListener('click', () => {
			this.elements.importModal.classList.add('hidden');
		});
		this.elements.exportForm.addEventListener('submit', (e) => this.handleExport(e));
		this.elements.importForm.addEventListener('submit', (e) => this.handleImport(e));

		// Fixed Items Events
		this.elements.fixedItemsBtn.addEventListener('click', () => {
			this.fetchFixedItems();
			this.elements.fixedItemsModal.classList.remove('hidden');
		});
		this.elements.closeFixedModalBtn.addEventListener('click', () => {
			this.elements.fixedItemsModal.classList.add('hidden');
		});
		this.elements.addFixedItemBtn.addEventListener('click', () => {
			this.elements.fixedItemForm.reset();
			this.elements.fixedItemForm.querySelector('input[name="id"]').value = '';
			this.elements.fixedFormTitle.textContent = this.t('fixed_item_form_title');

			// Init categories for fixed items
			this.updateFixedItemFormState();

			this.elements.fixedItemFormModal.classList.remove('hidden');

			// Initial check for payment methods
			this.updateFixedItemPaymentMethodOptions();
		});

		this.elements.cancelFixedFormBtn.addEventListener('click', () => {
			this.elements.fixedItemFormModal.classList.add('hidden');
		});

		this.elements.fixedItemForm.addEventListener('submit', (e) => this.handleFixedItemSubmit(e));
		this.elements.generateFixedBtn.addEventListener('click', () => this.generateFixedTransactions());

		// Fixed Item Form Type Change
		const fixedTypeRadios = this.elements.fixedItemForm.querySelectorAll('input[name="type"]');
		fixedTypeRadios.forEach(radio => {
			radio.addEventListener('change', () => {
				this.updateFixedItemFormState();
			});
		});

		// Filter Events
		this.elements.filterType.addEventListener('change', (e) => {
			const type = e.target.value;
			this.state.filterParams.type = type;

			// Toggle month input visibility
			if (type === 'month') {
				this.elements.filterMonth.classList.remove('hidden');
			} else {
				this.elements.filterMonth.classList.add('hidden');
			}

			this.fetchTransactions();
		});

		this.elements.filterMonth.addEventListener('change', (e) => {
			this.state.filterParams.month = e.target.value;
			this.fetchTransactions();
		});

		// Init filter inputs
		this.elements.filterMonth.value = this.state.filterParams.month;

		if (this.elements.themeSelector) {
			this.elements.themeSelector.value = this.state.theme;
			this.elements.themeSelector.addEventListener('change', (e) => {
				this.applyTheme(e.target.value);
			});
		}

		if (this.elements.languageSelector) {
			this.elements.languageSelector.value = this.state.currentLanguage;
			this.elements.languageSelector.addEventListener('change', (e) => {
				this.setLanguage(e.target.value);
			});
		}

		// Date input default to today
		const dateInput = this.elements.transactionForm.querySelector('input[name="date"]');
		if (dateInput) {
			dateInput.valueAsDate = new Date();
		}


		// Settings Events
		if (this.elements.updateRateBtn) {
			this.elements.updateRateBtn.addEventListener('click', () => this.handleUpdateRate());
		}

		// Chart Toggle
		if (this.elements.toggleChartBtn) {
			this.elements.toggleChartBtn.addEventListener('click', () => {
				const isHidden = this.elements.chartContainer.classList.contains('hidden');
				if (isHidden) {
					this.elements.chartContainer.classList.remove('hidden');
					this.elements.toggleChartBtn.textContent = '👁️';
					this.updateChart(); // Re-render if showing
				} else {
					this.elements.chartContainer.classList.add('hidden');
					this.elements.toggleChartBtn.textContent = '🔒'; // Or eye-slash
				}
				localStorage.setItem('parfin_chart_visible', !isHidden);
			});
		}

		// Restore chart state
		const isChartVisible = localStorage.getItem('parfin_chart_visible') !== 'false'; // Default true
		if (!isChartVisible) {
			this.elements.chartContainer.classList.add('hidden');
			if (this.elements.toggleChartBtn) this.elements.toggleChartBtn.textContent = '🔒';
		}

		// Sort Events
		document.querySelectorAll('th[data-sort]').forEach(th => {
			th.addEventListener('click', () => {
				this.handleSort(th.dataset.sort);
			});
		});
	},

	t(key) {
		const lang = this.state.currentLanguage;
		if (translations[lang] && translations[lang][key]) {
			return translations[lang][key];
		}
		return key; // Fallback
	},

	setLanguage(lang) {
		this.state.currentLanguage = lang;
		localStorage.setItem('parfin_language', lang);
		this.elements.languageSelector.value = lang;
		this.updateUIText();

		// Refresh dynamic content
		if (this.state.transactions.length > 0) {
			this.renderTransactions();
			this.updateStats();
			this.updateChart();
		}
	},

	updateUIText() {
		// Update text content for elements with data-i18n
		document.querySelectorAll('[data-i18n]').forEach(el => {
			const key = el.getAttribute('data-i18n');
			el.textContent = this.t(key);
		});

		// Update placeholders for elements with data-i18n-placeholder
		document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
			const key = el.getAttribute('data-i18n-placeholder');
			el.placeholder = this.t(key);
		});
	},

	async checkAuth() {
		// Simple check if user data exists in localStorage (Mock session persistence)
		const user = localStorage.getItem('parfin_user');
		if (user) {
			this.state.currentUser = JSON.parse(user);
			this.showDashboard();
		} else {
			this.showLogin();
		}
	},

	async handleLogin(e) {
		e.preventDefault();
		const formData = new FormData(e.target);
		const data = Object.fromEntries(formData.entries());

		try {
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});

			const result = await response.json();

			if (response.ok) {
				this.state.currentUser = result.user;
				localStorage.setItem('parfin_user', JSON.stringify(result.user));
				this.showDashboard();
				this.showToast(this.t('toast_welcome'), 'success');
			} else {
				this.showToast(result.error || this.t('toast_login_fail'), 'error');
			}
		} catch (err) {
			this.showToast(this.t('toast_connect_error'), 'error');
		}
	},

	handleLogout() {
		this.state.currentUser = null;
		localStorage.removeItem('parfin_user');
		this.showLogin();
	},

	showLogin() {
		this.elements.loginView.classList.remove('hidden');
		this.elements.dashboardView.classList.add('hidden');
	},

	showDashboard() {
		this.elements.loginView.classList.add('hidden');
		this.elements.dashboardView.classList.remove('hidden');
		const username = this.state.currentUser.username;

		// Update both displays if they exist
		if (this.elements.userDisplayName) this.elements.userDisplayName.textContent = username;
		if (this.elements.sidebarUserName) this.elements.sidebarUserName.textContent = username;

		this.fetchTransactions();
	},

	initSidebar() {
		// Restore Collapsed State
		const isCollapsed = localStorage.getItem('parfin_sidebar_collapsed') === 'true';
		if (isCollapsed) {
			this.elements.mainSidebar.classList.add('collapsed');
		}

		// Restore Active View (Optional, defaulted to first in HTML)
		// For now, let's just ensure the active class in HTML matches the visible view
		const activeNav = document.querySelector('.nav-item.active');
		if (activeNav) {
			this.switchView(activeNav);
		}
	},

	switchView(navItem) {
		const targetViewId = navItem.dataset.view;

		// Update Nav UI
		this.elements.navItems.forEach(item => item.classList.remove('active'));
		navItem.classList.add('active');

		// Update View UI
		this.elements.viewSections.forEach(section => {
			if (section.id === targetViewId) {
				section.classList.remove('hidden');
				// section.classList.add('fade-in'); // Optional animation class
			} else {
				section.classList.add('hidden');
			}
		});

		// Special handling for views if needed
		if (targetViewId === 'view-monthly') {
			this.updateChart(); // Resize chart if needed
		}
	},

	async fetchTransactions() {
		try {
			const userId = 1; // Hack: For this simple version without session cookies

			let url = '/api/transactions';
			if (this.state.filterParams.type === 'month') {
				url += `?month=${this.state.filterParams.month}`;
			}

			const response = await fetch(url);
			if (response.ok) {
				const transactions = await response.json();
				this.state.transactions = transactions;
				this.renderTransactions();
				this.updateStats();
				this.updateChart();
			}
		} catch (err) {
			console.error('Failed to fetch transactions', err);
		}
	},

	async handleTransactionSubmit(e) {
		e.preventDefault();
		const formData = new FormData(e.target);
		const data = Object.fromEntries(formData.entries());

		// Add user_id (Mocking logic, server should infer from session)
		data.user_id = 1;

		// Determine currency based on current language context if not explicitly set (which it isn't in form)
		// If adding new: use current language currency
		// If editing: we should probably preserve original? OR update to new?
		// Decision: Update to current language currency because the user is seeing/editing the amount in that currency.
		data.currency = this.state.currentLanguage === 'vi' ? 'VND' : 'USD';

		const isEdit = !!data.id;
		const url = isEdit ? '/api/transactions/update' : '/api/transactions/create';

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});

			if (response.ok) {
				this.hideModal();
				this.elements.transactionForm.reset();
				this.fetchTransactions();
				this.showToast(isEdit ? this.t('toast_update_success') : this.t('toast_add_success'), 'success');
			} else {
				this.showToast(this.t('toast_error'), 'error');
			}
		} catch (err) {
			this.showToast(this.t('toast_save_error'), 'error');
		}
	},

	async deleteTransaction(id) {
		if (!confirm(this.t('toast_delete_confirm'))) return;

		try {
			const response = await fetch('/api/transactions/delete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});

			if (response.ok) {
				this.fetchTransactions();
				this.showToast(this.t('toast_delete_success'), 'success');
			} else {
				this.showToast(this.t('toast_delete_error'), 'error');
			}
		} catch (err) {
			this.showToast(this.t('toast_connect_error'), 'error');
		}
	},

	editTransaction(id) {
		const transaction = this.state.transactions.find(t => t.id === id);
		if (!transaction) return;

		const form = this.elements.transactionForm;
		form.id.value = transaction.id;

		// Show amount in the CURRENT display currency
		// Because the user will edit it in their current context
		// e.g. if transaction is 10 USD, and I am in VND mode, I want to see ~250,000 to edit.
		let displayAmount = this.convertAmount(transaction.amount, transaction.currency);

		// Rounding Logic:
		// If Vietnam (VND), usually no decimals.
		// If English (USD), 2 decimals.
		if (this.state.currentLanguage === 'vi') {
			displayAmount = Math.round(displayAmount);
		} else {
			displayAmount = parseFloat(displayAmount.toFixed(2));
		}

		form.amount.value = displayAmount;

		const typeRadios = form.querySelectorAll('input[name="type"]');
		typeRadios.forEach(radio => {
			radio.checked = radio.value === transaction.type;
		});

		// Trigger state update to show/hide fields
		this.updateTransactionFormState();

		form.category.value = transaction.category;
		form.description.value = transaction.description || '';
		form.date.value = transaction.date;
		form.source.value = transaction.source || 'cash';
		if (transaction.type === 'allocation' && transaction.category === 'Transfer') {
			form.destination.value = transaction.destination || 'bank';
		}
		form.fund.value = transaction.fund || '';

		this.elements.modalTitle.textContent = this.t('modal_edit_title');
		this.showModal();
	},

	async fetchSettings() {
		try {
			const response = await fetch('/api/settings');
			if (response.ok) {
				const settings = await response.json();
				this.state.settings = settings;

				// Update UI if exists
				if (this.elements.exchangeRateInput && settings.exchange_rate_usd_vnd) {
					this.elements.exchangeRateInput.value = settings.exchange_rate_usd_vnd;
				}

				// CRITICAL FIX: Refresh dynamic content that depends on settings (like exchange rate)
				// This fixes the race condition where transactions render before settings are loaded on page refresh
				if (this.state.transactions.length > 0) {
					this.renderTransactions();
					this.updateStats();
					this.updateChart();
				}
			}
		} catch (err) {
			console.error('Failed to fetch settings', err);
		}
	},

	async handleUpdateRate() {
		const rate = this.elements.exchangeRateInput.value;
		if (!rate) return;

		try {
			const response = await fetch('/api/settings/update', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ exchange_rate_usd_vnd: rate })
			});

			if (response.ok) {
				this.state.settings.exchange_rate_usd_vnd = rate;
				this.showToast(this.t('toast_rate_success'), 'success');
				// Refresh stats/transactions to reflect new rate
				this.renderTransactions();
				this.updateStats();
				this.updateChart();
			} else {
				this.showToast(this.t('toast_error'), 'error');
			}
		} catch (err) {
			this.showToast(this.t('toast_connect_error'), 'error');
		}
	},

	renderTransactions() {
		try {
			const tbody = this.elements.transactionListBody;
			if (!tbody) return;
			tbody.innerHTML = '';

			const transactions = Array.isArray(this.state.transactions) ? this.state.transactions : [];

			if (transactions.length === 0) {
				tbody.innerHTML = `<tr><td colspan="6" class="text-center text-secondary" style="padding: 2rem">${this.t('no_transactions')}</td></tr>`;
				return;
			}

			const locale = this.state.currentLanguage === 'vi' ? 'vi-VN' : 'en-US';

			// Sort transactions
			const sortParams = this.state.sortParams || { field: 'date', direction: 'desc' };
			const { field, direction } = sortParams;

			const sortedTransactions = [...transactions].sort((a, b) => {
				if (!a || !b) return 0;
				if (field === 'date') {
					const dateA = new Date(a.date);
					const dateB = new Date(b.date);
					if (isNaN(dateA)) return 1; // Push invalid dates to bottom
					if (isNaN(dateB)) return -1;
					if (dateA < dateB) return direction === 'asc' ? -1 : 1;
					if (dateA > dateB) return direction === 'asc' ? 1 : -1;
					// Secondary sort by ID (Time proxy)
					return direction === 'asc' ? ((a.id || 0) - (b.id || 0)) : ((b.id || 0) - (a.id || 0));
				}
				if (field === 'amount') {
					// Sort by absolute amount magnitude
					return direction === 'asc' ? (a.amount - b.amount) : (b.amount - a.amount);
				}
				return 0;
			});

			// Update Sort Icons
			document.querySelectorAll('th[data-sort]').forEach(th => {
				const sortField = th.dataset.sort;
				const icon = th.querySelector('.sort-icon');
				if (sortField === field) {
					icon.textContent = direction === 'asc' ? ' ↑' : ' ↓';
					th.classList.add('text-primary'); // Highlight active sort
				} else {
					icon.textContent = '';
					th.classList.remove('text-primary');
				}
			});


			sortedTransactions.forEach(t => {
				const tr = document.createElement('tr');
				tr.className = 'border-b text-sm hovering-row';
				tr.style.borderColor = 'var(--bg-accent)';

				const isExpense = t.type === 'expense';
				const sign = isExpense ? '-' : '+';
				const colorClass = isExpense ? 'text-danger' : 'text-success';
				const categoryName = this.getCategoryName(t.category);

				const sourceName = this.t(t.source === 'bank' ? 'source_bank' : 'source_cash');
				let destName = '';
				if (t.type === 'allocation' && t.category === 'Transfer') {
					destName = ' ➔ ' + this.t(t.destination === 'bank' ? 'source_bank' : 'source_cash');
				}

				// Fund display
				let fundBadge = '';
				if (t.fund) {
					const fundKey = `fund_${t.fund.toLowerCase()}`;
					const fundLabel = this.t(fundKey);
					fundBadge = `<span class="badge badge-info" style="margin-left: 0.5rem; font-size: 0.75rem;">${fundLabel}</span>`;
				} else if (t.type === 'allocation' && t.category === 'Transfer') {
					// Badge for transfer
					fundBadge = `<span class="badge badge-warning" style="margin-left: 0.5rem; font-size: 0.75rem;">Transfer</span>`;
				}

				tr.innerHTML = `
                <td class="p-4">${new Date(t.date).toLocaleDateString(locale)}</td>
                <td class="p-4">
                    <div class="flex items-center gap-sm">
                        <span>${this.getCategoryIcon(t.category)}</span>
                        <span>${categoryName}</span>
                    </div>
                </td>
                <td class="p-4 text-secondary">${t.description || '-'}</td>
                <td class="p-4 text-right font-bold ${colorClass}">${sign} ${this.formatCurrency(t.amount, t.currency)}</td>
                <td class="p-4 text-secondary">
					<div class="flex items-center">
						<span class="text-xs">${sourceName}${destName}</span>
						${fundBadge}
					</div>
				</td>
                <td class="p-4 text-right">
                    <button class="btn-icon edit-btn" data-id="${t.id}" style="margin-right: 0.5rem">✏️</button>
                    <button class="btn-icon delete-btn" data-id="${t.id}">🗑️</button>
                </td>
            `;
				tbody.appendChild(tr);
			});

			// Delegate events
			tbody.querySelectorAll('.edit-btn').forEach(btn => {
				btn.addEventListener('click', () => this.editTransaction(parseInt(btn.dataset.id)));
			});
			tbody.querySelectorAll('.delete-btn').forEach(btn => {
				btn.addEventListener('click', () => this.deleteTransaction(parseInt(btn.dataset.id)));
			});
		} catch (err) {
			console.error('Error rendering transactions:', err);
			if (this.elements.transactionListBody) {
				this.elements.transactionListBody.innerHTML = `<tr><td colspan="6" class="text-danger text-center p-4">Error loading transactions. Please refresh.</td></tr>`;
			}
		}
	},

	handleSort(field) {
		if (this.state.sortParams.field === field) {
			this.state.sortParams.direction = this.state.sortParams.direction === 'asc' ? 'desc' : 'asc';
		} else {
			this.state.sortParams.field = field;
			this.state.sortParams.direction = 'desc';
		}
		this.renderTransactions();
	},

	updateStats() {
		const transactions = this.state.transactions;

		// Initialize balance objects
		let total = { cash: 0, bank: 0 };
		let saving = { cash: 0, bank: 0 };
		let support = { cash: 0, bank: 0 };
		let investment = { cash: 0, bank: 0 };
		let together = { cash: 0, bank: 0 };

		let monthlyIncome = 0;
		let monthlyExpense = 0;

		// Helper to ensure source is valid
		const getSource = (source) => source === 'bank' ? 'bank' : 'cash';
		const fromCurrency = 'VND'; // Hardcoded base currency for now as DB defaults to VND

		transactions.forEach(t => {
			const source = getSource(t.source);
			// Convert amount to the target display currency for aggregation
			const amount = this.convertAmount(t.amount, t.currency || fromCurrency);

			// --- Monthly Stats ---
			if (t.type === 'income') {
				monthlyIncome += amount;
			} else if (t.type === 'expense') {
				const allocationCategories = ['Saving', 'Support', 'Investment', 'Together'];
				// Only count as expense if it's NOT an allocation category (legacy check)
				if (!allocationCategories.includes(t.category)) {
					monthlyExpense += amount;
				}
			}

			// --- Balance Logic ---

			// 1. INCOME
			if (t.type === 'income') {
				total[source] += amount;
			} else if (t.type === 'expense') {
				// 2. EXPENSE
				// If Fund is used, deduct from Fund Balance
				if (t.fund) {
					const fundSource = source; // Assumption: Paying via Cash/Bank reduces that specific Fund pool
					if (t.fund === 'Saving') saving[fundSource] -= amount;
					else if (t.fund === 'Support') support[fundSource] -= amount;
					else if (t.fund === 'Investment') investment[fundSource] -= amount;
					else if (t.fund === 'Together') together[fundSource] -= amount;
				} else {
					// If NO Fund used, deduct from General Balance
					total[source] -= amount;

					// Legacy Logic: If Category is a Fund Name (but type is Expense and no fund used)
					// This implies "Allocating" to that fund via Expense (Old definition)
					// We treat this as: General Source Decreases (done above), Fund Balance Increases
					if (t.category === 'Saving') saving[source] += amount;
					else if (t.category === 'Support') support[source] += amount;
					else if (t.category === 'Investment') investment[source] += amount;
					else if (t.category === 'Together') together[source] += amount;
				}
			} else if (t.type === 'allocation') {
				// 3. ALLOCATION
				// General Rule: Deduct from Source (General Balance)
				total[source] -= amount;

				if (t.category === 'Transfer') {
					// Transfer between accounts (e.g. Cash -> Bank)
					// Source decreased (above). Destination increases.
					const destination = t.destination === 'bank' ? 'bank' : 'cash';
					total[destination] += amount;
				} else {
					// Allocation to Fund
					// Source decreased (General). Fund increases.
					// We assume the fund grows in the same "currency type" as the source
					// e.g. Allocate Bank -> Investment (Bank)
					if (t.category === 'Saving') saving[source] += amount;
					else if (t.category === 'Support') support[source] += amount;
					else if (t.category === 'Investment') investment[source] += amount;
					else if (t.category === 'Together') together[source] += amount;
				}
			}
		});

		// Calculate Totals for display (Sum of Cash + Bank)
		const totalBalanceVal = total.cash + total.bank;
		const totalSavingVal = saving.cash + saving.bank;
		const totalSupportVal = support.cash + support.bank;
		const totalInvestmentVal = investment.cash + investment.bank;
		const totalTogetherVal = together.cash + together.bank;

		const targetCurrency = this.state.currentLanguage === 'vi' ? 'VND' : 'USD';

		// Update DOM
		// Note: The values are ALREADY in the target currency, so we pass targetCurrency as the 'from' currency
		// to prevent double conversion in formatCurrency
		this.elements.totalBalance.textContent = this.formatCurrency(totalBalanceVal, targetCurrency);
		this.elements.balanceCash.textContent = this.formatCurrency(total.cash, targetCurrency);
		this.elements.balanceBank.textContent = this.formatCurrency(total.bank, targetCurrency);

		this.elements.monthlyIncome.textContent = this.formatCurrency(monthlyIncome, targetCurrency);
		this.elements.monthlyExpense.textContent = this.formatCurrency(monthlyExpense, targetCurrency);

		if (this.elements.totalSaving) {
			this.elements.totalSaving.textContent = this.formatCurrency(totalSavingVal, targetCurrency);
			this.elements.savingCash.textContent = this.formatCurrency(saving.cash, targetCurrency);
			this.elements.savingBank.textContent = this.formatCurrency(saving.bank, targetCurrency);
		}
		if (this.elements.totalSupport) {
			this.elements.totalSupport.textContent = this.formatCurrency(totalSupportVal, targetCurrency);
			this.elements.supportCash.textContent = this.formatCurrency(support.cash, targetCurrency);
			this.elements.supportBank.textContent = this.formatCurrency(support.bank, targetCurrency);
		}
		if (this.elements.totalInvestment) {
			this.elements.totalInvestment.textContent = this.formatCurrency(totalInvestmentVal, targetCurrency);
			this.elements.investmentCash.textContent = this.formatCurrency(investment.cash, targetCurrency);
			this.elements.investmentBank.textContent = this.formatCurrency(investment.bank, targetCurrency);
		}
		if (this.elements.totalTogether) {
			this.elements.totalTogether.textContent = this.formatCurrency(totalTogetherVal, targetCurrency);
			this.elements.togetherCash.textContent = this.formatCurrency(together.cash, targetCurrency);
			this.elements.togetherBank.textContent = this.formatCurrency(together.bank, targetCurrency);
		}

		// Store balances in state for form logic
		this.state.balances = {
			total: total,
			saving: saving,
			support: support,
			investment: investment,
			together: together
		};
	},

	updateChart() {
		const ctx = this.elements.allocationChart ? this.elements.allocationChart.getContext('2d') : null;
		if (!ctx) return;

		// Filter for expenses
		const expenses = this.state.transactions.filter(t => t.type === 'expense');

		// Aggregate by category and source
		const categoryData = {};

		expenses.forEach(t => {
			if (!categoryData[t.category]) {
				categoryData[t.category] = { cash: 0, bank: 0 };
			}
			const source = t.source === 'bank' ? 'bank' : 'cash';
			// Convert!
			const amount = this.convertAmount(t.amount, t.currency || 'VND');
			categoryData[t.category][source] += amount;
		});

		const labels = Object.keys(categoryData).map(cat => this.getCategoryName(cat));
		const cashData = Object.values(categoryData).map(d => d.cash);
		const bankData = Object.values(categoryData).map(d => d.bank);

		if (this.state.chart) {
			this.state.chart.destroy();
		}

		this.state.chart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: labels,
				datasets: [
					{
						label: this.state.currentLanguage === 'vi' ? 'Tiền mặt' : 'Cash',
						data: cashData,
						backgroundColor: '#4BC0C0',
					},
					{
						label: this.state.currentLanguage === 'vi' ? 'Ngân hàng' : 'Bank',
						data: bankData,
						backgroundColor: '#36A2EB',
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					x: {
						stacked: true,
					},
					y: {
						stacked: true,
						beginAtZero: true
					}
				},
				plugins: {
					tooltip: {
						callbacks: {
							label: (context) => {
								let label = context.dataset.label || '';
								if (label) {
									label += ': ';
								}
								if (context.parsed.y !== null) {
									const targetCurrency = this.state.currentLanguage === 'vi' ? 'VND' : 'USD';
									label += this.formatCurrency(context.parsed.y, targetCurrency);
								}
								return label;
							}
						}
					}
				}
			}
		});
	},

	convertAmount(amount, fromCurrency = 'VND') {
		const targetCurrency = this.state.currentLanguage === 'vi' ? 'VND' : 'USD';

		// If same currency, return as is
		if (fromCurrency === targetCurrency) return amount;

		// Get Rate (Default 25000 if not set)
		const rate = parseFloat(this.state.settings.exchange_rate_usd_vnd) || 25000;

		if (fromCurrency === 'VND' && targetCurrency === 'USD') {
			return amount / rate;
		} else if (fromCurrency === 'USD' && targetCurrency === 'VND') {
			return amount * rate;
		}

		return amount; // Fallback
	},

	formatCurrency(amount, fromCurrency = 'VND') {
		const convertedAmount = this.convertAmount(amount, fromCurrency);
		const locale = this.state.currentLanguage === 'vi' ? 'vi-VN' : 'en-US';
		const currency = this.state.currentLanguage === 'vi' ? 'VND' : 'USD';
		return new Intl.NumberFormat(locale, { style: 'currency', currency: currency }).format(convertedAmount);
	},

	getCategoryIcon(category) {
		const icons = {
			'Food': '🍜',
			'Transport': '🚗',
			'Shopping': '🛍️',
			'Bills': '💡',
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
	},

	getCategoryName(categoryKey) {
		// return name based on translation key 'category_<lower_key>'
		const key = `category_${categoryKey.toLowerCase()}`;
		return this.t(key);
	},

	showModal() {
		this.elements.transactionModal.classList.remove('hidden');
	},

	hideModal() {
		this.elements.transactionModal.classList.add('hidden');
	},

	showToast(message, type = 'info') {
		const toast = document.createElement('div');
		toast.className = 'toast';
		toast.textContent = message;
		if (type === 'error') toast.style.borderColor = 'var(--danger)';
		if (type === 'success') toast.style.borderColor = 'var(--success)';

		this.elements.toastContainer.appendChild(toast);

		setTimeout(() => {
			toast.remove();
		}, 3000);
	},

	applyTheme(theme) {
		this.state.theme = theme;
		localStorage.setItem('parfin_theme', theme);

		// Remove existing theme attributes
		document.documentElement.removeAttribute('data-theme');

		if (theme === 'dark') {
			document.documentElement.setAttribute('data-theme', 'dark');
		} else if (theme === 'light') {
			document.documentElement.setAttribute('data-theme', 'light');
		}
		// 'system' uses no attribute, falling back to media query
	},

	async handleExport(e) {
		e.preventDefault();
		const formData = new FormData(e.target);
		const period = formData.get('period');
		const format = formData.get('format');

		let url = `/api/export?format=${format}`;

		if (period === 'current') {
			const currentMonth = this.state.filterParams.month; // YYYY-MM
			url += `&month=${currentMonth}`;
		} else {
			url += `&month=all`;
		}

		// Trigger download
		window.open(url, '_blank');

		this.elements.exportModal.classList.add('hidden');
		this.showToast(this.t('toast_export_process'), 'success');
	},

	async handleImport(e) {
		e.preventDefault();
		const formData = new FormData(e.target);
		const file = formData.get('file');

		if (!file) return;

		const reader = new FileReader();
		reader.onload = async (event) => {
			const content = event.target.result;
			const isJson = file.name.toLowerCase().endsWith('.json');
			const format = isJson ? 'json' : 'csv';

			try {
				const response = await fetch('/api/import', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						format: format,
						data: isJson ? JSON.parse(content) : content
					})
				});

				const result = await response.json();

				if (response.ok) {
					this.elements.importModal.classList.add('hidden');
					this.elements.importForm.reset();
					this.fetchTransactions();
					this.showToast(this.t('toast_import_success'), 'success');
				} else {
					this.showToast(result.error || this.t('toast_import_fail'), 'error');
				}
			} catch (err) {
				console.error(err);
				this.showToast(this.t('toast_import_error') + err.message, 'error');
			}
		};

		reader.readAsText(file);
	},

	async fetchFixedItems() {
		try {
			const response = await fetch('/api/fixed_items');
			if (response.ok) {
				this.state.fixedItems = await response.json();
				this.renderFixedItems();
			}
		} catch (err) {
			console.error('Failed to fetch fixed items', err);
		}
	},

	renderFixedItems() {
		const tbody = this.elements.fixedItemsListBody;
		tbody.innerHTML = '';

		if (this.state.fixedItems.length === 0) {
			tbody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary" style="padding: 2rem">${this.t('no_transactions')}</td></tr>`;
			return;
		}

		this.state.fixedItems.forEach(item => {
			const tr = document.createElement('tr');
			tr.className = 'border-b text-sm hovering-row';
			tr.style.borderColor = 'var(--bg-accent)';

			const isExpense = item.type === 'expense';
			const colorClass = isExpense ? 'text-danger' : 'text-success';
			const categoryName = this.getCategoryName(item.category);

			tr.innerHTML = `
                <td class="p-4">
                    <div class="flex items-center gap-sm">
                        <span>${this.getCategoryIcon(item.category)}</span>
                        <span>${categoryName}</span>
                    </div>
                </td>
                <td class="p-4 text-secondary">${item.description || '-'}</td>
                <td class="p-4 text-right font-bold ${colorClass}">${this.formatCurrency(item.amount)}</td>
                <td class="p-4">${item.type === 'income' ? this.t('type_income') : this.t('type_expense')}</td>
                <td class="p-4 text-right">
                    <button class="btn-icon edit-fixed-btn" data-id="${item.id}" style="margin-right: 0.5rem">✏️</button>
                    <button class="btn-icon delete-fixed-btn" data-id="${item.id}">🗑️</button>
                </td>
            `;
			tbody.appendChild(tr);
		});

		// Delegate events
		tbody.querySelectorAll('.edit-fixed-btn').forEach(btn => {
			btn.addEventListener('click', () => this.editFixedItem(parseInt(btn.dataset.id)));
		});
		tbody.querySelectorAll('.delete-fixed-btn').forEach(btn => {
			btn.addEventListener('click', () => this.deleteFixedItem(parseInt(btn.dataset.id)));
		});
	},

	updateFixedItemFormState() {
		const form = this.elements.fixedItemForm;
		const typeRadios = form.querySelectorAll('input[name="type"]');
		let type = 'expense';
		typeRadios.forEach(r => { if (r.checked) type = r.value; });

		const categorySelect = form.querySelector('select[name="category"]');
		const useFundGroup = form.querySelector('#fixed-use-fund-group');
		const destGroup = form.querySelector('#fixed-destination-group');

		// 1. Update Categories
		categorySelect.innerHTML = '';
		let categories = [];
		if (type === 'income') {
			categories = ['Salary', 'Investment', 'Other'];
		} else if (type === 'allocation') {
			categories = ['Transfer', 'Saving', 'Support', 'Investment', 'Together'];
		} else {
			// Expense types
			categories = [
				'Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health',
				'Investment', 'Saving', 'Debt', 'Support', 'Personal', 'Together', 'Other'
			];
		}

		categories.forEach(cat => {
			const option = document.createElement('option');
			option.value = cat;
			option.textContent = this.getCategoryName(cat);
			categorySelect.appendChild(option);
		});

		// 2. Toggle "Use Fund" Visibility (Only for Expense)
		if (type === 'expense') {
			useFundGroup.classList.remove('hidden');
		} else {
			useFundGroup.classList.add('hidden');
			form.fund.value = '';
		}

		// 3. Toggle Destination field visibility
		const updateVisibility = () => {
			if (type === 'allocation' && categorySelect.value === 'Transfer') {
				destGroup.classList.remove('hidden');
			} else {
				destGroup.classList.add('hidden');
			}
		};

		if (!form.dataset.catBound) {
			categorySelect.addEventListener('change', updateVisibility);
			form.dataset.catBound = 'true';
		}

		updateVisibility();

		// 4. Update Use Fund Options (Dynamic Filtering)
		if (type === 'expense') {
			this.updateFixedItemUseFundOptions();
			if (!form.dataset.fundBound) {
				form.fund.addEventListener('change', () => this.updateFixedItemPaymentMethodOptions());
				form.dataset.fundBound = 'true';
			}
		} else {
			// For Income and Allocation, trigger payment method update directly
			this.updateFixedItemPaymentMethodOptions();
		}
	},

	calculateFixedItemBalances() {
		// This method should calculate projected balances based on current balances
		// and potentially other fixed items.
		// For now, returning current balances as a placeholder.
		return this.state.balances;
	},

	updateFixedItemUseFundOptions() {
		const form = this.elements.fixedItemForm;
		const fundSelect = form.fund;
		// Use Projected Balances for Fixed Items logic
		const balances = this.calculateFixedItemBalances();

		if (!balances || Object.keys(balances).length === 0) return;

		const currentValue = fundSelect.value;

		const fundMap = {
			'': 'total',
			'Saving': 'saving',
			'Support': 'support',
			'Investment': 'investment',
			'Together': 'together'
		};

		const options = [
			{ value: '', label: this.t('fund_none') },
			{ value: 'Saving', label: this.t('fund_saving') },
			{ value: 'Support', label: this.t('fund_support') },
			{ value: 'Investment', label: this.t('fund_investment') },
			{ value: 'Together', label: this.t('fund_together') }
		];

		fundSelect.innerHTML = '';

		options.forEach(opt => {
			const stateKey = fundMap[opt.value];
			const balanceObj = balances[stateKey];
			// Logic parity: Show if balance > 0
			// For planning, we might want to be permissive, but keeping strict ensures budget validity
			const available = balanceObj ? (balanceObj.cash + balanceObj.bank) > 0 : false;

			// Always allow None for Expense in Fixed Items? No, enforce budget.
			if (available) {
				const option = document.createElement('option');
				option.value = opt.value;
				option.textContent = opt.label;
				fundSelect.appendChild(option);
			}
		});

		const availableValues = Array.from(fundSelect.options).map(o => o.value);
		if (availableValues.includes(currentValue)) {
			fundSelect.value = currentValue;
		} else if (availableValues.length > 0) {
			fundSelect.value = availableValues[0];
		}

		this.updateFixedItemPaymentMethodOptions();
	},

	updateFixedItemPaymentMethodOptions() {
		const form = this.elements.fixedItemForm;
		const fundSelect = form.fund;
		const sourceSelect = form.source;
		// Use Projected Balances
		const balances = this.calculateFixedItemBalances();

		const typeRadios = form.querySelectorAll('input[name="type"]');
		let type = 'expense';
		typeRadios.forEach(r => { if (r.checked) type = r.value; });

		// INCOME: Always show all options
		if (type === 'income') {
			const currentSource = sourceSelect.value;
			sourceSelect.innerHTML = '';
			const optCash = document.createElement('option');
			optCash.value = 'cash';
			optCash.textContent = this.t('source_cash');
			sourceSelect.appendChild(optCash);

			const optBank = document.createElement('option');
			optBank.value = 'bank';
			optBank.textContent = this.t('source_bank');
			sourceSelect.appendChild(optBank);

			const availableSources = ['cash', 'bank'];
			if (availableSources.includes(currentSource)) {
				sourceSelect.value = currentSource;
			}
			return;
		}

		if (!balances) return;

		// EXPENSE or ALLOCATION
		let stateKey = 'total';

		if (type === 'expense') {
			const selectedFundValue = fundSelect.value;
			const fundMap = {
				'': 'total',
				'Saving': 'saving',
				'Support': 'support',
				'Investment': 'investment',
				'Together': 'together'
			};
			stateKey = fundMap[selectedFundValue];
		}

		const balanceObj = balances[stateKey];
		const currentSource = sourceSelect.value;
		sourceSelect.innerHTML = '';

		if (balanceObj) {
			if (balanceObj.cash > 0) {
				const optCash = document.createElement('option');
				optCash.value = 'cash';
				optCash.textContent = this.t('source_cash');
				sourceSelect.appendChild(optCash);
			}
			if (balanceObj.bank > 0) {
				const optBank = document.createElement('option');
				optBank.value = 'bank';
				optBank.textContent = this.t('source_bank');
				sourceSelect.appendChild(optBank);
			}
		}

		// Fallback for planning: if projected balance is 0 or less, effectively blocking the option
		// Maybe add a visual indicator? For now, standard filter.

		const availableSources = Array.from(sourceSelect.options).map(o => o.value);
		if (availableSources.includes(currentSource)) {
			sourceSelect.value = currentSource;
		} else if (availableSources.length > 0) {
			sourceSelect.value = availableSources[0]; // Select first available
		}
	},

	async handleFixedItemSubmit(e) {
		e.preventDefault();
		const formData = new FormData(e.target);
		const data = Object.fromEntries(formData.entries());
		data.user_id = 1; // Mock user

		const isEdit = !!data.id;
		const url = isEdit ? '/api/fixed_items/update' : '/api/fixed_items/create';

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});

			if (response.ok) {
				this.elements.fixedItemFormModal.classList.add('hidden');
				this.fetchFixedItems();
				this.showToast(this.t('toast_save_success'), 'success');
			} else {
				this.showToast(this.t('toast_error'), 'error');
			}
		} catch (err) {
			this.showToast(this.t('toast_save_error'), 'error');
		}
	},

	editFixedItem(id) {
		const item = this.state.fixedItems.find(i => i.id === id);
		if (!item) return;

		const form = this.elements.fixedItemForm;
		form.id.value = item.id;
		form.amount.value = item.amount;

		// Set type first to trigger category update
		const typeRadios = form.querySelectorAll('input[name="type"]');
		typeRadios.forEach(radio => {
			if (radio.value === item.type) {
				radio.checked = true;
			} else {
				// Legacy check if needed
				if (item.type !== 'income' && radio.value === 'expense') {
					radio.checked = true;
				}
			}
		});

		this.updateFixedItemFormState();

		form.category.value = item.category;
		form.description.value = item.description || '';
		form.source.value = item.source || 'cash';
		form.fund.value = item.fund || '';
		if (item.type === 'allocation' && item.category === 'Transfer') {
			form.destination.value = item.destination || 'bank';
		}

		this.elements.fixedFormTitle.textContent = this.t('edit_fixed_item_title') || 'Edit Fixed Item';
		this.elements.fixedItemFormModal.classList.remove('hidden');
	},

	async deleteFixedItem(id) {
		if (!confirm(this.t('toast_delete_confirm'))) return;

		try {
			const response = await fetch('/api/fixed_items/delete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});

			if (response.ok) {
				this.fetchFixedItems();
				this.showToast(this.t('toast_delete_success'), 'success');
			} else {
				this.showToast(this.t('toast_delete_error'), 'error');
			}
		} catch (err) {
			this.showToast(this.t('toast_connect_error'), 'error');
		}
	},

	async generateFixedTransactions() {
		// Default to current month of filter or today's month
		let date = this.state.filterParams.month;
		if (!date) date = new Date().toISOString().slice(0, 7);

		// Append day 01 as default for the transaction date
		const fullDate = `${date}-01`;

		if (!confirm(`Generate transactions for ${date}?`)) return;

		try {
			const response = await fetch('/api/fixed_items/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_id: 1, date: fullDate })
			});

			const result = await response.json();

			if (response.ok) {
				this.elements.fixedItemsModal.classList.add('hidden');
				this.fetchTransactions();
				this.showToast(`${this.t('toast_generated_success')} (${result.count})`, 'success');
			} else {
				this.showToast(result.error || this.t('toast_error'), 'error');
			}
		} catch (err) {
			this.showToast(this.t('toast_connect_error'), 'error');
		}
	},

	updateTransactionFormState() {
		const form = this.elements.transactionForm;
		const typeRadios = form.querySelectorAll('input[name="type"]');
		let type = 'expense';
		typeRadios.forEach(r => { if (r.checked) type = r.value; });

		const categorySelect = form.querySelector('select[name="category"]');
		const destGroup = form.querySelector('#destination-group');
		const useFundGroup = form.querySelector('#use-fund-group');

		// 1. Update Categories
		let categories = [];
		if (type === 'income') {
			categories = ['Salary', 'Other', 'Investment'];
		} else if (type === 'allocation') {
			categories = ['Transfer', 'Saving', 'Support', 'Investment', 'Together'];
		} else {
			// Expense
			categories = [
				'Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health',
				'Debt', 'Personal', 'Other'
			];
		}

		// Save current selection if possible
		const currentCat = categorySelect.value;
		categorySelect.innerHTML = '';
		categories.forEach(cat => {
			const option = document.createElement('option');
			option.value = cat;
			option.textContent = this.getCategoryName(cat);
			categorySelect.appendChild(option);
		});

		// Restore selection if valid, else select first
		if (categories.includes(currentCat)) {
			categorySelect.value = currentCat;
		}

		// 2. Toggle "Use Fund" Visibility (Only for Expense)
		if (type === 'expense') {
			useFundGroup.classList.remove('hidden');
		} else {
			useFundGroup.classList.add('hidden');
			// Reset fund selection when hidden to avoid accidental submission
			form.fund.value = '';
		}

		// 3. Toggle Destination field visibility
		const updateVisibility = () => {
			if (categorySelect.value === 'Transfer') {
				destGroup.classList.remove('hidden');
			} else {
				destGroup.classList.add('hidden');
			}
		};

		if (!form.dataset.catBound) {
			categorySelect.addEventListener('change', updateVisibility);
			form.dataset.catBound = 'true';
		}

		updateVisibility(); // Initial check

		// 4. Update Use Fund Options (Dynamic Filtering)
		// 4. Update Use Fund Options (Dynamic Filtering)
		if (type === 'expense') {
			this.updateUseFundOptions();
			// Bind change event for dynamic Payment Method filtering
			if (!form.dataset.fundBound) {
				form.fund.addEventListener('change', () => this.updatePaymentMethodOptions());
				form.dataset.fundBound = 'true';
			}
		} else {
			// For Income and Allocation, trigger payment method update directly
			this.updatePaymentMethodOptions();
		}
	},

	updateUseFundOptions() {
		const form = this.elements.transactionForm;
		const fundSelect = form.fund;
		const balances = this.state.balances;

		if (!balances || Object.keys(balances).length === 0) return;

		// Keep current value if possible
		const currentValue = fundSelect.value;

		// Map values to state keys
		const fundMap = {
			'': 'total', // None uses General/Total pool (actually Free Balance, but using Total for now as approximation or logic)
			// Correction: "None" means spending from "Free Cash/Bank". 
			// We track "Total Balance" which is the sum of everything? 
			// Wait, looking at updateStats:
			// total[source] tracks the GENERAL pool (Cash + Bank).
			// So yes, 'total' corresponds to 'None'.
			'Saving': 'saving',
			'Support': 'support',
			'Investment': 'investment',
			'Together': 'together'
		};

		// Options to check
		const options = [
			{ value: '', label: this.t('fund_none') },
			{ value: 'Saving', label: this.t('fund_saving') },
			{ value: 'Support', label: this.t('fund_support') },
			{ value: 'Investment', label: this.t('fund_investment') },
			{ value: 'Together', label: this.t('fund_together') }
		];

		fundSelect.innerHTML = '';

		options.forEach(opt => {
			const stateKey = fundMap[opt.value];
			const balanceObj = balances[stateKey];
			// Show if balance exists and Total (Cash + Bank) > 0
			// Always show 'None' if we want to allow negative general balance? 
			// User requirement: "Use Fund option only display if total amount available."
			const available = balanceObj ? (balanceObj.cash + balanceObj.bank) > 0 : false;

			if (available) {
				const option = document.createElement('option');
				option.value = opt.value;
				option.textContent = opt.label; // + ` (${this.formatCurrency(balanceObj.cash + balanceObj.bank)})` ? No, just label.
				fundSelect.appendChild(option);
			}
		});

		// Fallback: If current value is no longer valid, select first available
		const availableValues = Array.from(fundSelect.options).map(o => o.value);
		if (availableValues.includes(currentValue)) {
			fundSelect.value = currentValue;
		} else if (availableValues.length > 0) {
			fundSelect.value = availableValues[0];
		}

		// Trigger payment method update
		this.updatePaymentMethodOptions();
	},

	updatePaymentMethodOptions() {
		const form = this.elements.transactionForm;
		const fundSelect = form.fund;
		const sourceSelect = form.source;
		const balances = this.state.balances;

		// Get current type
		const typeRadios = form.querySelectorAll('input[name="type"]');
		let type = 'expense';
		typeRadios.forEach(r => { if (r.checked) type = r.value; });

		// INCOME: Always show all options
		if (type === 'income') {
			// Keep current selection if possible
			const currentSource = sourceSelect.value;

			sourceSelect.innerHTML = '';
			const optCash = document.createElement('option');
			optCash.value = 'cash';
			optCash.textContent = this.t('source_cash');
			sourceSelect.appendChild(optCash);

			const optBank = document.createElement('option');
			optBank.value = 'bank';
			optBank.textContent = this.t('source_bank');
			sourceSelect.appendChild(optBank);

			// Restore selection
			const availableSources = ['cash', 'bank'];
			if (availableSources.includes(currentSource)) {
				sourceSelect.value = currentSource;
			}
			return;
		}

		if (!balances) return;

		// EXPENSE or ALLOCATION

		let stateKey = 'total'; // Default to General Pool (Allocation or Expense-None)

		if (type === 'expense') {
			const selectedFundValue = fundSelect.value;
			const fundMap = {
				'': 'total',
				'Saving': 'saving',
				'Support': 'support',
				'Investment': 'investment',
				'Together': 'together'
			};
			stateKey = fundMap[selectedFundValue];
		}
		// For Allocation, stateKey remains 'total' (General Pool)

		const balanceObj = balances[stateKey];

		// Keep current source selection if possible
		const currentSource = sourceSelect.value;

		sourceSelect.innerHTML = '';

		if (balanceObj) {
			if (balanceObj.cash > 0) {
				const optCash = document.createElement('option');
				optCash.value = 'cash';
				optCash.textContent = this.t('source_cash');
				sourceSelect.appendChild(optCash);
			}
			if (balanceObj.bank > 0) {
				const optBank = document.createElement('option');
				optBank.value = 'bank';
				optBank.textContent = this.t('source_bank');
				sourceSelect.appendChild(optBank);
			}
		}

		// Restore selection
		const availableSources = Array.from(sourceSelect.options).map(o => o.value);
		if (availableSources.includes(currentSource)) {
			sourceSelect.value = currentSource;
		} else if (availableSources.length > 0) {
			sourceSelect.value = availableSources[0]; // Select first available
		}
	},

	calculateFixedItemBalances() {
		const fixedItems = this.state.fixedItems || [];

		// Initialize balance objects (Same structure as main balances)
		let total = { cash: 0, bank: 0 };
		let saving = { cash: 0, bank: 0 };
		let support = { cash: 0, bank: 0 };
		let investment = { cash: 0, bank: 0 };
		let together = { cash: 0, bank: 0 };

		const getSource = (source) => source === 'bank' ? 'bank' : 'cash';

		fixedItems.forEach(t => {
			const source = getSource(t.source);
			const amount = t.amount;

			// 1. INCOME
			if (t.type === 'income') {
				total[source] += amount;
			} else if (t.type === 'expense') {
				// 2. EXPENSE
				if (t.fund) {
					const fundSource = source;
					if (t.fund === 'Saving') saving[fundSource] -= amount;
					else if (t.fund === 'Support') support[fundSource] -= amount;
					else if (t.fund === 'Investment') investment[fundSource] -= amount;
					else if (t.fund === 'Together') together[fundSource] -= amount;
				} else {
					total[source] -= amount;

					// Legacy Logic for Expense Categories acting as Allocation
					if (t.category === 'Saving') saving[source] += amount;
					else if (t.category === 'Support') support[source] += amount;
					else if (t.category === 'Investment') investment[source] += amount;
					else if (t.category === 'Together') together[source] += amount;
				}
			} else if (t.type === 'allocation') {
				// 3. ALLOCATION
				total[source] -= amount;

				if (t.category === 'Transfer') {
					const destination = t.destination === 'bank' ? 'bank' : 'cash';
					total[destination] += amount;
				} else {
					// Allocation to Fund
					if (t.category === 'Saving') saving[source] += amount;
					else if (t.category === 'Support') support[source] += amount;
					else if (t.category === 'Investment') investment[source] += amount;
					else if (t.category === 'Together') together[source] += amount;
				}
			}
		});

		return {
			total: total,
			saving: saving,
			support: support,
			investment: investment,
			together: together
		};
	}
};

document.addEventListener('DOMContentLoaded', () => {
	App.init();
});
