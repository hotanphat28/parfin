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
		chart: null
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
		modalTitle: document.getElementById('modal-title')
	},

	init() {
		this.applyTheme(this.state.theme);
		this.setLanguage(this.state.currentLanguage);
		this.bindEvents();
		this.checkAuth();
	},

	bindEvents() {
		this.elements.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
		this.elements.logoutBtn.addEventListener('click', () => this.handleLogout());
		this.elements.addTransactionBtn.addEventListener('click', () => {
			this.elements.transactionForm.reset();
			this.elements.transactionForm.querySelector('input[name="id"]').value = '';
			const dateInput = this.elements.transactionForm.querySelector('input[name="date"]');
			if (dateInput) dateInput.valueAsDate = new Date();
			this.elements.modalTitle.textContent = this.t('modal_add_title');
			this.showModal();
		});
		this.elements.cancelTransactionBtn.addEventListener('click', () => this.hideModal());
		this.elements.transactionForm.addEventListener('submit', (e) => this.handleTransactionSubmit(e));

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
		this.elements.userDisplayName.textContent = this.state.currentUser.username;
		this.fetchTransactions();
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
		form.amount.value = transaction.amount;
		form.type.value = transaction.type;

		// Handle radio buttons for type
		const typeRadios = form.querySelectorAll('input[name="type"]');
		typeRadios.forEach(radio => {
			radio.checked = radio.value === transaction.type;
		});

		form.category.value = transaction.category;
		form.description.value = transaction.description || '';
		form.date.value = transaction.date;
		form.source.value = transaction.source || 'cash';

		this.elements.modalTitle.textContent = this.t('modal_edit_title');
		this.showModal();
	},

	renderTransactions() {
		const tbody = this.elements.transactionListBody;
		tbody.innerHTML = '';

		if (this.state.transactions.length === 0) {
			tbody.innerHTML = `<tr><td colspan="6" class="text-center text-secondary" style="padding: 2rem">${this.t('no_transactions')}</td></tr>`;
			return;
		}

		const locale = this.state.currentLanguage === 'vi' ? 'vi-VN' : 'en-US';

		this.state.transactions.forEach(t => {
			const tr = document.createElement('tr');
			tr.className = 'border-b text-sm hovering-row';
			tr.style.borderColor = 'var(--bg-accent)';

			const isExpense = t.type === 'expense';
			const sign = isExpense ? '-' : '+';
			const colorClass = isExpense ? 'text-danger' : 'text-success';
			const categoryName = this.getCategoryName(t.category);
			const sourceName = t.source === 'bank' ? (this.state.currentLanguage === 'vi' ? '🏦 Ngân hàng' : '🏦 Bank') : (this.state.currentLanguage === 'vi' ? '💵 Tiền mặt' : '💵 Cash');

			tr.innerHTML = `
                <td class="p-4">${new Date(t.date).toLocaleDateString(locale)}</td>
                <td class="p-4">
                    <div class="flex items-center gap-sm">
                        <span>${this.getCategoryIcon(t.category)}</span>
                        <span>${categoryName}</span>
                    </div>
                </td>
                <td class="p-4 text-secondary">${t.description || '-'}</td>
                <td class="p-4 text-right font-bold ${colorClass}">${sign} ${this.formatCurrency(t.amount)}</td>
                <td class="p-4 text-secondary">${sourceName}</td>
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
	},

	updateStats() {
		const transactions = this.state.transactions;
		const total = transactions.reduce((acc, t) => {
			return t.type === 'income' ? acc + t.amount : acc - t.amount;
		}, 0);

		const income = transactions
			.filter(t => t.type === 'income')
			.reduce((acc, t) => acc + t.amount, 0);

		const expense = transactions
			.filter(t => t.type === 'expense')
			.reduce((acc, t) => acc + t.amount, 0);

		this.elements.totalBalance.textContent = this.formatCurrency(total);
		this.elements.monthlyIncome.textContent = this.formatCurrency(income);
		this.elements.monthlyExpense.textContent = this.formatCurrency(expense);
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
			categoryData[t.category][source] += t.amount;
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
									label += this.formatCurrency(context.parsed.y);
								}
								return label;
							}
						}
					}
				}
			}
		});
	},

	formatCurrency(amount) {
		const locale = this.state.currentLanguage === 'vi' ? 'vi-VN' : 'en-US';
		const currency = this.state.currentLanguage === 'vi' ? 'VND' : 'USD';
		// For ParFin, we are keeping the value as VND internally, but let's just format it as VND always for now, 
		// but using the correct locale punctuation.
		// Wait, if I change to EN, showing VND might be weird if I don't convert. 
		// But I am not doing currency conversion. So I should probably keep it as VND but formatted nicely.
		return new Intl.NumberFormat(locale, { style: 'currency', currency: 'VND' }).format(amount);
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
	}
};

document.addEventListener('DOMContentLoaded', () => {
	App.init();
});
