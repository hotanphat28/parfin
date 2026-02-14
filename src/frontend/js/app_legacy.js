/**
 * ParFin Application Logic
 */

const App = {
	state: {
		currentUser: null,
		transactions: [],
		investments: [], // Investment transactions
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
		toggleChartBtn: document.getElementById('toggle-chart-btn'),
		// Investment Elements
		investmentModal: document.getElementById('investment-modal'),
		investmentForm: document.getElementById('investment-form'),
		investmentHistoryBody: document.getElementById('inv-history-body'),
		holdingsBody: document.getElementById('holdings-list-body'),
		invTotalInvested: document.getElementById('inv-total-invested'),
		invCurrentValue: document.getElementById('inv-current-value'),
		invTotalPL: document.getElementById('inv-total-pl'),
		invAvailableCash: document.getElementById('inv-available-cash')
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

			// Clear target datasets to prevent pollution
			delete this.elements.transactionForm.dataset.targetFund;
			delete this.elements.transactionForm.dataset.targetSource;
			delete this.elements.transactionForm.dataset.targetDestCategory;

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

			// Clear target datasets
			delete this.elements.fixedItemForm.dataset.targetFixedDestCategory;

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

		// Investment Form Submit
		if (this.elements.investmentForm) {
			this.elements.investmentForm.addEventListener('submit', (e) => this.handleInvestmentSubmit(e));
		}

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

	// --- Investment Logic ---
	openInvestmentModal(type) {
		const modal = this.elements.investmentModal;
		const form = this.elements.investmentForm;
		const title = document.getElementById('inv-modal-title');

		form.reset();
		form.querySelector('input[name="date"]').valueAsDate = new Date();
		document.getElementById('inv-type').value = type;
		// Reset asset type
		const assetTypeSelect = form.querySelector('select[name="asset_type"]');
		if (assetTypeSelect) assetTypeSelect.value = 'stock';

		// Dynamic UI based on type
		const qtyGroup = document.getElementById('inv-qty-group');
		const priceGroup = document.getElementById('inv-price-group');
		const taxGroup = document.getElementById('inv-tax-group');

		// Show all defaults
		qtyGroup.classList.remove('hidden');
		priceGroup.classList.remove('hidden');
		taxGroup.classList.add('hidden');

		if (type === 'buy') {
			title.textContent = this.t('buy_stock_btn');
			title.setAttribute('data-i18n', 'buy_stock_btn');
		} else if (type === 'sell') {
			title.textContent = this.t('sell_stock_btn');
			title.setAttribute('data-i18n', 'sell_stock_btn');
			taxGroup.classList.remove('hidden');
		} else if (type === 'dividend') {
			title.textContent = this.t('record_dividend_btn');
			title.setAttribute('data-i18n', 'record_dividend_btn');
			qtyGroup.classList.add('hidden'); // Usually just total amount for dividend, or per share? 
			// Let's keep it simple: Record TOTAL dividend amount. 
			// But user might want per share. 
			// For now, let's treat "Price" as "Total Amount" for Dividend if Qty is 0?
			// Or keep Qty and Price and calc total.
			title.textContent = this.t('record_dividend_title');
			title.setAttribute('data-i18n', 'record_dividend_title');
			// Simplify for user: Quantity = 1, Price = Total Dividend Amount
			qtyGroup.classList.add('hidden');
			form.querySelector('input[name="quantity"]').value = 1;
			const priceLabel = document.querySelector('#inv-price-group label');
			priceLabel.textContent = this.t('total_dividend_amount');
			priceLabel.setAttribute('data-i18n', 'total_dividend_amount');
			taxGroup.classList.remove('hidden');
		}

		if (type !== 'dividend') {
			const priceLabel = document.querySelector('#inv-price-group label');
			priceLabel.textContent = this.t('price_per_share_label');
			priceLabel.setAttribute('data-i18n', 'price_per_share_label');
		}

		modal.classList.remove('hidden');
	},

	async fetchInvestments() {
		try {
			const response = await fetch('/api/investments');
			if (response.ok) {
				this.state.investments = await response.json();
				this.renderInvestments();
				this.updateStats(); // Re-calc available cash
			}
		} catch (err) {
			console.error('Failed to fetch investments', err);
		}
	},

	async handleInvestmentSubmit(e) {
		e.preventDefault();
		const formData = new FormData(e.target);
		const data = Object.fromEntries(formData.entries());
		data.user_id = 1;

		// Validation logic could go here

		try {
			const response = await fetch('/api/investments/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});

			if (response.ok) {
				this.elements.investmentModal.classList.add('hidden');
				this.fetchInvestments();
				this.showToast(this.t('toast_inv_saved'), 'success');
			} else {
				this.showToast('Error saving transaction', 'error');
			}
		} catch (err) {
			this.showToast('Connection error', 'error');
		}
	},

	renderInvestments() {
		const historyBody = this.elements.investmentHistoryBody;
		const holdingsBody = this.elements.holdingsBody;
		if (!historyBody || !holdingsBody) return;

		historyBody.innerHTML = '';
		holdingsBody.innerHTML = '';

		const investments = this.state.investments;

		if (investments.length === 0) {
			historyBody.innerHTML = `<tr><td colspan="7" class="text-center p-4">${this.t('no_transactions')}</td></tr>`;
			holdingsBody.innerHTML = `<tr><td colspan="6" class="text-center p-4">${this.t('no_holdings')}</td></tr>`;
			return;
		}

		// 1. History
		investments.forEach(t => {
			const tr = document.createElement('tr');
			tr.className = 'border-b text-sm';

			let colorClass = t.type === 'buy' ? 'text-danger' : 'text-success';
			let sign = t.type === 'buy' ? '-' : '+';
			// Total Value of transaction
			let total = (t.quantity * t.price);
			if (t.type === 'buy') total += t.fee;
			if (t.type === 'sell') total -= (t.fee + t.tax);
			if (t.type === 'dividend') total = (t.price * t.quantity) - t.tax; // price here is total amount if qty 1

			tr.innerHTML = `
                <td class="p-4">${t.date}</td>
                <td class="p-4"><span class="badge badge-info">${this.t('asset_type_' + (t.asset_type || 'stock'))}</span></td>
                <td class="p-4 font-bold">${t.symbol}</td>
                <td class="p-4"><span class="badge badge-${t.type === 'buy' ? 'info' : (t.type === 'dividend' ? 'success' : 'warning')}">${this.t('inv_type_' + t.type)}</span></td>
                <td class="p-4 text-right">${t.quantity}</td>
                <td class="p-4 text-right">${this.formatCurrency(t.price)}</td>
                <td class="p-4 text-right font-bold ${colorClass}">${sign} ${this.formatCurrency(total)}</td>
                <td class="p-4 text-right">
                    <button class="btn-icon delete-btn" onclick="App.deleteInvestment(${t.id})">🗑️</button>
                </td>
            `;
			historyBody.appendChild(tr);
		});

		// 2. Holdings Calculation
		const holdings = {};
		investments.forEach(t => {
			if (!holdings[t.symbol]) {
				holdings[t.symbol] = { qty: 0, cost: 0, div: 0 };
			}

			if (t.type === 'buy') {
				holdings[t.symbol].qty += t.quantity;
				holdings[t.symbol].cost += (t.quantity * t.price) + t.fee;
			} else if (t.type === 'sell') {
				holdings[t.symbol].qty -= t.quantity;
				// Cost basis reduction (FIFO/Avg) - Simplified Avg for now
				// We don't reduce total cost here for P/L calc in a simple way,
				// But typically: Realized P/L is separate.
				// For "Portfolio Holdings", we just show current Qty.
				// Avg Price is tricky without proper accounting.
				// Simple avg price = Total Cost / Total Bought (Adjusted?)
				// Let's just track Net Cost remaining?
				// Proper: Avg Cost = (Previous Total Cost + New Cost) / Total Qty
				// Sell reduces Total Cost by Avg Cost * Sell Qty
			}
		});

		// Re-calc Avg Cost properly
		const portfolio = {};
		// Process chronologically for accurate Avg Cost
		const sortedInv = [...investments].sort((a, b) => new Date(a.date) - new Date(b.date));

		sortedInv.forEach(t => {
			const assetType = t.asset_type || 'stock';
			const key = `${assetType}:${t.symbol}`;
			if (!portfolio[key]) portfolio[key] = { qty: 0, totalCost: 0, symbol: t.symbol, asset_type: assetType };

			if (t.type === 'buy') {
				portfolio[key].totalCost += (t.quantity * t.price) + t.fee;
				portfolio[key].qty += t.quantity;
			} else if (t.type === 'sell') {
				if (portfolio[key].qty > 0) {
					const avgCost = portfolio[key].totalCost / portfolio[key].qty;
					portfolio[key].totalCost -= (avgCost * t.quantity);
					portfolio[key].qty -= t.quantity;
				}
			}
		});

		// Render Holdings
		let totalInvested = 0;
		let hasHoldings = false;

		for (const [key, data] of Object.entries(portfolio)) {
			if (data.qty > 0.0001) { // Ignore near zero float errors
				hasHoldings = true;
				const symbol = data.symbol;
				const assetType = data.asset_type;
				const avgPrice = data.totalCost / data.qty;
				const mktPrice = avgPrice; // Mock: Current Price = Avg Price (0% P/L) for now since we don't have live data
				const totalValue = data.qty * mktPrice;

				totalInvested += data.totalCost;

				const tr = document.createElement('tr');
				tr.className = 'border-b text-sm';
				tr.innerHTML = `
                    <td class="p-4"><span class="badge badge-info">${this.t('asset_type_' + assetType)}</span></td>
                    <td class="p-4 font-bold">${symbol}</td>
                    <td class="p-4 text-right">${data.qty.toFixed(2)}</td>
                    <td class="p-4 text-right">${this.formatCurrency(avgPrice)}</td>
                     <td class="p-4 text-right">${this.formatCurrency(mktPrice)}</td>
                      <td class="p-4 text-right">${this.formatCurrency(totalValue)}</td>
                       <td class="p-4 text-right">0.00%</td>
                `;
				holdingsBody.appendChild(tr);
			}
		}

		if (!hasHoldings) {
			holdingsBody.innerHTML = `<tr><td colspan="6" class="text-center p-4">No active holdings</td></tr>`;
		}

		// Update Summary Cards
		if (this.elements.invTotalInvested) {
			this.elements.invTotalInvested.textContent = this.formatCurrency(totalInvested);
			this.elements.invCurrentValue.textContent = this.formatCurrency(totalInvested); // Mock equal
		}
	},

	async deleteInvestment(id) {
		if (!confirm('Delete this investment transaction?')) return;
		try {
			const response = await fetch('/api/investments/delete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});

			if (response.ok) {
				this.fetchInvestments();
				this.showToast('Deleted', 'success');
			}
		} catch (e) { console.error(e); }
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
		this.fetchInvestments(); // Fetch investments on load
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
	// ... (rest of old code - updateStats etc)



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

		// Set intended target values in dataset to ensure they are preserved during option rebuilding
		// even if they don't currently exist in the DOM or are filtered out by default logic.
		form.dataset.targetFund = transaction.fund || '';
		form.dataset.targetSource = transaction.source || 'cash';

		// Set form values FIRST
		form.category.value = transaction.category;
		form.description.value = transaction.description || '';
		form.date.value = transaction.date;
		form.source.value = transaction.source || 'cash';
		form.fund.value = transaction.fund || '';
		if (transaction.type === 'allocation') {
			form.destination.value = transaction.destination || 'bank';
			// form.destination_category.value = transaction.destination_category || ''; // Set by updateTransactionFormState
			form.dataset.targetDestCategory = transaction.destination_category || '';
		}

		// Trigger state update to show/hide fields and populate options (will use dataset values)
		this.updateTransactionFormState();

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
				// Adjustment sign depends on amount
				let sign = isExpense ? '-' : '+';
				let colorClass = isExpense ? 'text-danger' : 'text-success';

				if (t.type === 'adjustment') {
					// Adjustment Logic Removed
				}

				const categoryName = this.getCategoryName(t.category);

				const sourceName = this.t(t.source === 'bank' ? 'source_bank' : 'source_cash');
				let destName = '';
				if (t.type === 'allocation') {
					const destCatName = this.getCategoryName(t.destination_category || 'Transfer');
					destName = ' ➔ ' + destCatName + ' (' + this.t(t.destination === 'bank' ? 'source_bank' : 'source_cash') + ')';
				}

				// Fund display
				let fundBadge = '';
				if (t.fund) {
					const fundKey = `fund_${t.fund.toLowerCase()}`;
					const fundLabel = this.t(fundKey);
					fundBadge = `<span class="badge badge-info" style="margin-left: 0.5rem; font-size: 0.75rem;">${fundLabel}</span>`;
				} else if (t.type === 'allocation') {
					// Badge for transfer
					const destCatName = this.getCategoryName(t.destination_category || 'Transfer');
					fundBadge = `<span class="badge badge-warning" style="margin-left: 0.5rem; font-size: 0.75rem;">➔ ${destCatName}</span>`;
				}

				tr.innerHTML = `
                <td class="p-4">${new Date(t.date).toLocaleDateString(locale)}</td>
                <td class="p-4">
                    <div class="flex items-center gap-sm">
                        <span><i class="${this.getCategoryIcon(t.category)}"></i></span>
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
				const fundCategories = ['Saving', 'Support', 'Investment', 'Together'];
				if (fundCategories.includes(t.category)) {
					// Add directly to Fund Balance, NOT to Total (General)
					if (t.category === 'Saving') saving[source] += amount;
					else if (t.category === 'Support') support[source] += amount;
					else if (t.category === 'Investment') investment[source] += amount;
					else if (t.category === 'Together') together[source] += amount;
					// Note: 'total' here represents Unallocated/General Balance
				} else {
					// Salary, Other -> Add to General Balance
					total[source] += amount;
				}
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
				// 3. ALLOCATION (Transfer)
				// Source Logic: Deduct from Source
				// If Category is a Fund, deduct from that Fund. If "Salary" (General), deduct from General.
				const sourceFundCat = ['Saving', 'Support', 'Investment', 'Together'];
				if (sourceFundCat.includes(t.category)) {
					if (t.category === 'Saving') saving[source] -= amount;
					else if (t.category === 'Support') support[source] -= amount;
					else if (t.category === 'Investment') investment[source] -= amount;
					else if (t.category === 'Together') together[source] -= amount;
				} else {
					// General Balance (Salary,
					// 4. ALLOCATION (Incoming)
					total[source] -= amount;
				}

				// Destination Logic
				// If destination category is a Fund, add to Fund Balance
				if (t.destination_category) {
					// We need to know if the destination payment method is cash or bank
					// For allocations, the destination method is stored in t.destination
					const destSource = getSource(t.destination);
					if (t.destination_category === 'Saving') saving[destSource] += amount;
					else if (t.destination_category === 'Support') support[destSource] += amount;
					else if (t.destination_category === 'Investment') investment[destSource] += amount;
					else if (t.destination_category === 'Together') together[destSource] += amount;
					// If destination is not a specialized fund, it might just be a transfer to another account (handled by source deduction below, but here we add to general if it was just a transfer?
					// Wait, if it's "Transfer" type, usually it means moving money.
					// If destination is NONE of the special funds, we assume it goes back to General Balance (e.g. withdrawing from fund?)
					// For now, let's assume Allocation IS for Funds.
				}
			}
		});

		// --- Adjust Investment Balance for Trading Activity ---
		// The 'investment' balance above currently represents TOTAL CAPITAL ALLOCATED.
		// We need to reduce it by the amount currently "locked" in stocks to show AVAILABLE CASH.
		// Logic: Available = Allocated + NetCashFlow (where NetCashFlow is usually negative for Buys)

		let netInvestFlow = 0;
		if (this.state.investments && Array.isArray(this.state.investments)) {
			this.state.investments.forEach(inv => {
				// Determine trading impact
				let impact = 0;
				// Cost for Buy
				if (inv.type === 'buy') {
					impact = -1 * ((inv.quantity * inv.price) + inv.fee);
				}
				// Proceeds for Sell
				else if (inv.type === 'sell') {
					impact = (inv.quantity * inv.price) - inv.fee - inv.tax;
				}
				// Proceeds for Dividend
				else if (inv.type === 'dividend') {
					// if quantity 1, price is total.
					impact = (inv.quantity * inv.price) - inv.tax;
				}

				// Assume Bank for now
				invActivity.bank += impact;
			});
		}

		// Apply Investment Activity to Balance
		investment.bank += invActivity.bank;
		investment.cash += invActivity.cash;


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
		this.elements.totalBalance.textContent = this.formatCurrency(total.cash + total.bank + saving.cash + saving.bank + support.cash + support.bank + investment.cash + investment.bank + together.cash + together.bank);
		this.elements.balanceCash.textContent = this.formatCurrency(total.cash, targetCurrency);
		this.elements.balanceBank.textContent = this.formatCurrency(total.bank, targetCurrency);

		this.elements.monthlyIncome.textContent = this.formatCurrency(monthlyIncome, targetCurrency);
		this.elements.monthlyExpense.textContent = this.formatCurrency(monthlyExpense, targetCurrency);

		if (this.elements.totalSaving) {
			this.elements.totalSaving.textContent = this.formatCurrency(saving.cash + saving.bank);
			if (this.elements.savingCash) this.elements.savingCash.textContent = this.formatCurrency(saving.cash);
			if (this.elements.savingBank) this.elements.savingBank.textContent = this.formatCurrency(saving.bank);
		}
		if (this.elements.totalSupport) {
			this.elements.totalSupport.textContent = this.formatCurrency(support.cash + support.bank);
			if (this.elements.supportCash) this.elements.supportCash.textContent = this.formatCurrency(support.cash);
			if (this.elements.supportBank) this.elements.supportBank.textContent = this.formatCurrency(support.bank);
		}
		if (this.elements.totalInvestment) {
			this.elements.totalInvestment.textContent = this.formatCurrency(investment.cash + investment.bank);
			if (this.elements.investmentCash) this.elements.investmentCash.textContent = this.formatCurrency(investment.cash);
			if (this.elements.investmentBank) this.elements.investmentBank.textContent = this.formatCurrency(investment.bank);

			// Also update the "Available Cash" in Investment View
			if (this.elements.invAvailableCash) {
				this.elements.invAvailableCash.textContent = this.formatCurrency(investment.cash + investment.bank);
			}
		}
		if (this.elements.totalTogether) {
			this.elements.totalTogether.textContent = this.formatCurrency(together.cash + together.bank);
			if (this.elements.togetherCash) this.elements.togetherCash.textContent = this.formatCurrency(together.cash);
			if (this.elements.togetherBank) this.elements.togetherBank.textContent = this.formatCurrency(together.bank);
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
			'Food': 'fa-solid fa-utensils',
			'Transport': 'fa-solid fa-car',
			'Shopping': 'fa-solid fa-bag-shopping',
			'Bills': 'fa-solid fa-file-invoice-dollar',
			'Rent': 'fa-solid fa-house',
			'Utilities': 'fa-solid fa-bolt',
			'Entertainment': 'fa-solid fa-film',
			'Health': 'fa-solid fa-notes-medical',
			'Salary': 'fa-solid fa-sack-dollar',
			'Transfer': 'fa-solid fa-right-left',
			'Investment': 'fa-solid fa-chart-line',
			'Saving': 'fa-solid fa-piggy-bank',
			'Debt': 'fa-solid fa-credit-card',
			'Support': 'fa-solid fa-hand-holding-heart',
			'Personal': 'fa-solid fa-user',
			'Together': 'fa-solid fa-users',
			'Other': 'fa-solid fa-pen-to-square'
		};
		return icons[category] || 'fa-solid fa-pen-to-square';
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
                        <span><i class="${this.getCategoryIcon(item.category)}"></i></span>
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


		// UI Elements for Grid Layout
		const gridContainer = document.getElementById('fixed-transfer-grid');
		const sourceSection = document.getElementById('fixed-source-section');
		const sourceTitle = document.getElementById('fixed-source-title');

		// 1. Update Grid Layout and Section Styles based on Type
		if (type === 'allocation') {
			// Apply Grid Layout
			gridContainer.classList.add('transfer-grid');
			gridContainer.classList.remove('transfer-grid-default'); // Remove default block style if any

			sourceSection.classList.add('source-section');
			sourceSection.classList.remove('source-section-default');

			// Show Source Title
			sourceTitle.classList.remove('hidden');
			sourceTitle.style.display = 'block';
			sourceTitle.textContent = this.t('source_from_title');

			// Show Destination Group
			destGroup.classList.remove('hidden');

		} else {
			// Revert to Standard Layout
			gridContainer.classList.remove('transfer-grid');
			gridContainer.classList.add('transfer-grid-default');

			sourceSection.classList.remove('source-section');
			sourceSection.classList.add('source-section-default');

			// Hide Source Title
			sourceTitle.classList.add('hidden');
			sourceTitle.style.display = 'none';

			// Hide Destination Group
			destGroup.classList.add('hidden');
		}

		// 2. Update Categories
		categorySelect.innerHTML = '';
		let categories = [];
		if (type === 'income') {
			categories = ['Salary', 'Saving', 'Support', 'Investment', 'Other'];
		} else if (type === 'allocation') {
			categories = ['Salary', 'Other', 'Saving', 'Support', 'Investment', 'Together'];
		} else {
			// Expense output
			categories = [
				'Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health',
				'Debt', 'Personal', 'Other'
			];
		}

		categories.forEach(cat => {
			const option = document.createElement('option');
			option.value = cat;
			option.textContent = this.getCategoryName(cat);
			categorySelect.appendChild(option);
		});

		// 3. Toggle "Use Fund" Visibility (Only for Expense)
		if (type === 'expense') {
			useFundGroup.classList.remove('hidden');
		} else {
			useFundGroup.classList.add('hidden');
			form.fund.value = '';
		}

		// 4. Populate Destination Category (Only for Allocation)
		if (type === 'allocation') {
			const destSelect = form.querySelector('select[name="destination_category"]');
			// Save current if exists, or use target from dataset (Edit mode)
			const targetDest = form.dataset.targetFixedDestCategory;
			const currentDest = (targetDest !== undefined) ? targetDest : destSelect.value;

			destSelect.innerHTML = '<option value="" disabled selected>Select Destination Category</option>';
			const destCategories = ['Saving', 'Support', 'Investment', 'Together', 'Salary', 'Other'];

			destCategories.forEach(cat => {
				const option = document.createElement('option');
				option.value = cat;
				option.textContent = this.getCategoryName(cat);
				destSelect.appendChild(option);
			});
			if (currentDest && destCategories.includes(currentDest)) {
				destSelect.value = currentDest;
			}
		}

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
		if (item.type === 'allocation') {
			form.destination.value = item.destination || 'bank';
			// form.destination_category.value = item.destination_category || '';
			form.dataset.targetFixedDestCategory = item.destination_category || '';
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
			categories = ['Salary', 'Saving', 'Support', 'Investment', 'Other']; // Updated Income Categories, added Saving, Support
		} else if (type === 'allocation') {
			// Allocation Sources: Can come from ANY category (General or Funds)
			categories = [
				'Salary', 'Other', // General Sources
				'Saving', 'Support', 'Investment', 'Together' // Fund Sources
			];
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
			if (type === 'allocation') {
				destGroup.classList.remove('hidden');

				// Populate Destination Category
				const destSelect = form.querySelector('select[name="destination_category"]');
				// Save current if exists, or use target from dataset (Edit mode)
				const targetDest = form.dataset.targetDestCategory;
				const currentDest = (targetDest !== undefined) ? targetDest : destSelect.value;

				destSelect.innerHTML = '<option value="" disabled selected>Select Destination Category</option>';
				const destCategories = [
					'Saving', 'Support', 'Investment', 'Together', // Funds
					'Salary', 'Other' // General
				];

				destCategories.forEach(cat => {
					// Optional: specific filtering to prevent self-transfer loop?
					// For now allow all
					const option = document.createElement('option');
					option.value = cat;
					option.textContent = this.getCategoryName(cat);
					destSelect.appendChild(option);
				});

				if (currentDest && destCategories.includes(currentDest)) {
					destSelect.value = currentDest;
				}

			} else {
				destGroup.classList.add('hidden');
			}
		};

		if (!form.dataset.catBound) {
			// categorySelect.addEventListener('change', updateVisibility); // Removed check on category
			form.dataset.catBound = 'true';
		}

		updateVisibility(); // Initial check

		// 3.1 Update Section Titles & Grid Styling for UX
		const sourceTitle = form.querySelector('#source-title');
		const sourceSection = form.querySelector('#source-section');
		const transferGrid = form.querySelector('.transfer-grid');

		if (sourceTitle && sourceSection && transferGrid) {
			if (type === 'allocation') {
				sourceTitle.style.display = 'block'; // Ensure visible for allocation
				sourceTitle.textContent = this.t('source_from_title') || 'From (Source)';

				// Apply Grid & Styling for Allocation
				transferGrid.style.display = 'grid';
				transferGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(250px, 1fr))';
				transferGrid.style.gap = 'var(--space-md)';
				transferGrid.style.marginTop = 'var(--space-md)';

				sourceSection.classList.add('p-4', 'rounded', 'border', 'border-accent');
				sourceSection.style.background = 'var(--bg-secondary)';
			} else {
				sourceTitle.style.display = 'none'; // Hide for regular transactions

				// Remove Styling for regular Transacitons
				transferGrid.style.display = 'block';
				transferGrid.style.marginTop = '0';

				sourceSection.classList.remove('p-4', 'rounded', 'border', 'border-accent');
				sourceSection.style.background = 'transparent';
			}
		}

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
			// For Income, Allocation, and Adjustment, trigger payment method update directly
			this.updatePaymentMethodOptions();
		}
	},

	updateUseFundOptions() {
		const form = this.elements.transactionForm;
		const fundSelect = form.fund;
		const balances = this.state.balances;

		if (!balances || Object.keys(balances).length === 0) return;

		if (!balances || Object.keys(balances).length === 0) return;

		// Use target value from dataset if available (for Edit mode), otherwise current DOM value
		const targetValue = form.dataset.targetFund;
		const currentValue = (targetValue !== undefined) ? targetValue : fundSelect.value;

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
			// EXCEPTION: For Adjustment, always show all options
			const isAdjustment = this.elements.transactionForm.querySelector('input[name="type"]:checked').value === 'adjustment';
			const available = isAdjustment ? true : (balanceObj ? (balanceObj.cash + balanceObj.bank) > 0 : false);

			// Always show if it's the currently selected value (Preserve value on Edit)
			if (available || opt.value === currentValue) {
				const option = document.createElement('option');
				option.value = opt.value;
				option.textContent = opt.label;
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

		// Use target value from dataset if available (for Edit mode), otherwise current DOM value
		const targetSource = form.dataset.targetSource;
		const currentSource = (targetSource !== undefined) ? targetSource : sourceSelect.value;

		sourceSelect.innerHTML = '';

		if (balanceObj) {
			if (balanceObj.cash > 0 || currentSource === 'cash') {
				const optCash = document.createElement('option');
				optCash.value = 'cash';
				optCash.textContent = this.t('source_cash');
				sourceSelect.appendChild(optCash);
			}
			if (balanceObj.bank > 0 || currentSource === 'bank') {
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


};

document.addEventListener('DOMContentLoaded', () => {
	App.init();
});
