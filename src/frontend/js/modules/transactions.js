
import { Api } from '../api.js';
import { state } from '../state.js';
import { t, formatCurrency, getCategoryIcon, getCategoryName, showToast, convertAmount } from '../utils.js';

export const Transactions = {
	init() {
		// Static Header Actions (Always in index.html)
		const addBtn = document.getElementById('add-transaction-btn');
		if (addBtn) {
			// Remove existing to be safe (optional, but good practice if called multiple times)
			const newBtn = addBtn.cloneNode(true);
			addBtn.parentNode.replaceChild(newBtn, addBtn);
			newBtn.addEventListener('click', () => this.openAddModal());
		}

		// Handle Form (Modals might be loaded later)
		if (document.getElementById('transaction-form')) {
			this.bindModalEvents();
		}
		document.addEventListener('modals:loaded', () => this.bindModalEvents());

		// Listen for other events
		document.addEventListener('auth:login_success', () => {
			// If view is already active, fetch
			if (!document.getElementById('view-monthly').classList.contains('hidden')) {
				this.fetchAndRender();
			}
		});
		document.addEventListener('settings:updated', () => this.render());
	},

	onViewLoaded() {
		// Called when Monthly View is injected
		this.bindTableEvents();
		this.bindChartEvents();
		this.fetchAndRender(); // Fetch new data
	},

	bindChartEvents() {
		const toggleBtn = document.getElementById('toggle-chart-btn');
		const chartContainer = document.getElementById('chart-container');

		if (toggleBtn && chartContainer) {
			// Restore state
			const isVisible = localStorage.getItem('parfin_chart_visible') !== 'false';
			if (!isVisible) {
				chartContainer.classList.add('hidden');
				toggleBtn.textContent = '🔒';
			} else {
				toggleBtn.textContent = '👁️';
			}

			toggleBtn.addEventListener('click', () => {
				const isHidden = chartContainer.classList.contains('hidden');
				if (isHidden) {
					chartContainer.classList.remove('hidden');
					toggleBtn.textContent = '👁️';
					this.updateChart();
				} else {
					chartContainer.classList.add('hidden');
					toggleBtn.textContent = '🔒';
				}
				localStorage.setItem('parfin_chart_visible', !isHidden);
			});
		}
	},

	bindModalEvents() {
		const form = document.getElementById('transaction-form');
		if (!form || form.dataset.bound) return; // Prevent double binding

		const cancelBtn = document.getElementById('cancel-transaction-btn');
		if (cancelBtn) {
			const newBtn = cancelBtn.cloneNode(true);
			cancelBtn.parentNode.replaceChild(newBtn, cancelBtn);
			newBtn.addEventListener('click', () => this.hideModal());
		}

		form.addEventListener('submit', (e) => this.handleSubmit(e));

		const typeRadios = form.querySelectorAll('input[name="type"]');
		typeRadios.forEach(radio => {
			radio.addEventListener('change', () => this.updateFormState());
		});

		form.dataset.bound = "true";
	},

	bindTableEvents() {
		const tbody = document.getElementById('transaction-list-body');
		if (!tbody) return; // Should exist if view loaded

		// Filters
		const filterType = document.getElementById('filter-type');
		const filterMonth = document.getElementById('filter-month');

		if (filterType) {
			filterType.addEventListener('change', (e) => {
				const type = e.target.value;
				state.filterParams.type = type;
				if (type === 'month') {
					filterMonth.classList.remove('hidden');
				} else {
					filterMonth.classList.add('hidden');
				}
				this.fetchAndRender();
			});
		}

		if (filterMonth) {
			filterMonth.value = state.filterParams.month;
			filterMonth.addEventListener('change', (e) => {
				state.filterParams.month = e.target.value;
				this.fetchAndRender();
			});
		}

		// Sorting
		document.querySelectorAll('th[data-sort]').forEach(th => {
			th.addEventListener('click', () => {
				this.handleSort(th.dataset.sort);
			});
		});
	},

	async fetchAndRender() {
		try {
			const params = { ...state.filterParams };
			if (params.type === 'all') {
				delete params.month;
			}
			const data = await Api.getTransactions(params);
			state.transactions = data;
			this.render();
			// Dispatch event for other modules (Stats, Charts)
			document.dispatchEvent(new Event('transactions:updated'));
			this.updateStats();
			this.updateChart();
		} catch (err) {
			console.error(err);
			const tbody = document.getElementById('transaction-list-body');
			if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-danger text-center p-4">Error loading transactions.</td></tr>`;
		}
	},

	render() {
		const tbody = document.getElementById('transaction-list-body');
		if (!tbody) return;
		tbody.innerHTML = '';

		const transactions = Array.isArray(state.transactions) ? state.transactions : [];

		if (transactions.length === 0) {
			tbody.innerHTML = `<tr><td colspan="6" class="text-center text-secondary" style="padding: 2rem">${t('no_transactions')}</td></tr>`;
			return;
		}

		const locale = state.currentLanguage === 'vi' ? 'vi-VN' : 'en-US';
		const sortParams = state.sortParams;
		const { field, direction } = sortParams;

		const sortedTransactions = [...transactions].sort((a, b) => {
			if (!a || !b) return 0;
			if (field === 'date') {
				const dateA = new Date(a.date);
				const dateB = new Date(b.date);
				if (isNaN(dateA)) return 1;
				if (isNaN(dateB)) return -1;
				if (dateA < dateB) return direction === 'asc' ? -1 : 1;
				if (dateA > dateB) return direction === 'asc' ? 1 : -1;
				return direction === 'asc' ? ((a.id || 0) - (b.id || 0)) : ((b.id || 0) - (a.id || 0));
			}
			if (field === 'amount') {
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
				th.classList.add('text-primary');
			} else {
				icon.textContent = '';
				th.classList.remove('text-primary');
			}
		});

		sortedTransactions.forEach(transaction => {
			const tr = document.createElement('tr');
			tr.className = 'border-b text-sm hovering-row';
			tr.style.borderColor = 'var(--bg-accent)';

			const isExpense = transaction.type === 'expense';
			let sign = isExpense ? '-' : '+';
			let colorClass = isExpense ? 'text-danger' : 'text-success';

			const categoryName = getCategoryName(transaction.category);
			const sourceName = (transaction.source === 'bank' ? t('source_bank') : t('source_cash'));

			let destName = '';
			if (transaction.type === 'allocation') {
				const destCatName = getCategoryName(transaction.destination_category || 'Transfer');
				destName = ' ➔ ' + destCatName + ' (' + (transaction.destination === 'bank' ? t('source_bank') : t('source_cash')) + ')';
			}

			let fundBadge = '';
			if (transaction.fund) {
				const fundKey = `fund_${transaction.fund.toLowerCase()}`;
				const fundLabel = t(fundKey);
				fundBadge = `<span class="badge badge-info" style="margin-left: 0.5rem; font-size: 0.75rem;">${fundLabel}</span>`;
			} else if (transaction.type === 'allocation') {
				const destCatName = getCategoryName(transaction.destination_category || 'Transfer');
				fundBadge = `<span class="badge badge-warning" style="margin-left: 0.5rem; font-size: 0.75rem;">➔ ${destCatName}</span>`;
			}

			tr.innerHTML = `
                <td class="p-4">${new Date(transaction.date).toLocaleDateString(locale)}</td>
                <td class="p-4">
                    <div class="flex items-center gap-sm">
                        <span>${getCategoryIcon(transaction.category)}</span>
                        <span>${categoryName}</span>
                    </div>
                </td>
                <td class="p-4 text-secondary">${transaction.description || '-'}</td>
                <td class="p-4 text-right font-bold ${colorClass}">${sign} ${formatCurrency(transaction.amount, transaction.currency)}</td>
                <td class="p-4 text-secondary">
                    <div class="flex items-center">
                        <span class="text-xs">${sourceName}${destName}</span>
                        ${fundBadge}
                    </div>
                </td>
                <td class="p-4 text-right">
                    <button class="btn-icon edit-btn" style="margin-right: 0.5rem">✏️</button>
                    <button class="btn-icon delete-btn">🗑️</button>
                </td>
            `;

			tr.querySelector('.edit-btn').addEventListener('click', () => this.openEditModal(transaction));
			tr.querySelector('.delete-btn').addEventListener('click', () => this.handleDelete(transaction.id));

			tbody.appendChild(tr);
		});
	},

	openAddModal() {
		const form = document.getElementById('transaction-form');
		form.reset();
		form.querySelector('input[name="id"]').value = '';
		const dateInput = form.querySelector('input[name="date"]');
		if (dateInput) dateInput.valueAsDate = new Date();
		document.getElementById('modal-title').textContent = t('modal_add_title');

		delete form.dataset.targetFund;
		delete form.dataset.targetSource;
		delete form.dataset.targetDestCategory;

		this.updateFormState();
		this.showModal();
	},

	openEditModal(transaction) {
		const form = document.getElementById('transaction-form');
		form.id.value = transaction.id;

		// Conversion logic for display
		let displayAmount = convertAmount(transaction.amount, transaction.currency);
		if (state.currentLanguage === 'vi') {
			displayAmount = Math.round(displayAmount);
		} else {
			displayAmount = parseFloat(displayAmount.toFixed(2));
		}
		form.amount.value = displayAmount;

		const typeRadios = form.querySelectorAll('input[name="type"]');
		typeRadios.forEach(radio => {
			radio.checked = radio.value === transaction.type;
		});

		// Dataset for preservation
		form.dataset.targetFund = transaction.fund || '';
		form.dataset.targetSource = transaction.source || 'cash';

		form.category.value = transaction.category;
		form.description.value = transaction.description || '';
		form.date.value = transaction.date;
		form.source.value = transaction.source || 'cash';
		form.fund.value = transaction.fund || '';

		if (transaction.type === 'allocation') {
			form.destination.value = transaction.destination || 'bank';
			form.dataset.targetDestCategory = transaction.destination_category || '';
		}

		this.updateFormState();
		document.getElementById('modal-title').textContent = t('modal_edit_title');
		this.showModal();
	},

	updateFormState() {
		const form = document.getElementById('transaction-form');
		const typeRadios = form.querySelectorAll('input[name="type"]');
		let type = 'expense';
		typeRadios.forEach(r => { if (r.checked) type = r.value; });

		const categorySelect = form.querySelector('select[name="category"]');

		// Grid Logic
		const sourceSection = document.getElementById('source-section');
		const destGroup = document.getElementById('destination-group');
		const sourceTitle = document.getElementById('source-title');

		if (type === 'allocation') {
			sourceSection.classList.add('source-section');
			sourceTitle.classList.remove('hidden');
			sourceTitle.textContent = t('source_from_title');
			destGroup.classList.remove('hidden');
		} else {
			sourceSection.classList.remove('source-section');
			sourceTitle.textContent = t('source_details_title');
			destGroup.classList.add('hidden');
		}

		// Categories
		categorySelect.innerHTML = '';
		let categories = [];
		if (type === 'income') {
			categories = ['Salary', 'Saving', 'Support', 'Investment', 'Other'];
		} else if (type === 'allocation') {
			categories = ['Salary', 'Other', 'Saving', 'Support', 'Investment', 'Together'];
		} else {
			categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Debt', 'Personal', 'Other'];
		}

		categories.forEach(cat => {
			const option = document.createElement('option');
			option.value = cat;
			option.textContent = getCategoryName(cat);
			categorySelect.appendChild(option);
		});

		// Use Fund
		const useFundGroup = document.getElementById('use-fund-group');
		if (type === 'expense') {
			useFundGroup.classList.remove('hidden');
		} else {
			useFundGroup.classList.add('hidden');
			form.fund.value = '';
		}

		// Dest Category
		if (type === 'allocation') {
			const destSelect = form.querySelector('select[name="destination_category"]');
			const targetDest = form.dataset.targetDestCategory;
			const current = targetDest !== undefined ? targetDest : destSelect.value;

			destSelect.innerHTML = '<option value="" disabled selected>Select Destination Category</option>';
			const destCats = ['Saving', 'Support', 'Investment', 'Together', 'Salary', 'Other'];
			destCats.forEach(cat => {
				const option = document.createElement('option');
				option.value = cat;
				option.textContent = getCategoryName(cat);
				destSelect.appendChild(option);
			});
			if (current && destCats.includes(current)) destSelect.value = current;
		}
	},

	showModal() {
		document.getElementById('transaction-modal').classList.remove('hidden');
	},

	hideModal() {
		document.getElementById('transaction-modal').classList.add('hidden');
	},

	async handleSubmit(e) {
		e.preventDefault();
		const formData = new FormData(e.target);
		const data = Object.fromEntries(formData.entries());
		data.user_id = 1;
		data.currency = state.currentLanguage === 'vi' ? 'VND' : 'USD';

		try {
			const result = await Api.saveTransaction(data);
			if (result.ok) {
				this.hideModal();
				showToast(t(data.id ? 'toast_update_success' : 'toast_add_success'), 'success');
				this.fetchAndRender(); // update list
			} else {
				showToast(t('toast_error'), 'error');
			}
		} catch (e) {
			showToast(t('toast_save_error'), 'error');
		}
	},

	async handleDelete(id) {
		if (!confirm(t('toast_delete_confirm'))) return;
		try {
			const ok = await Api.deleteTransaction(id);
			if (ok) {
				showToast(t('toast_delete_success'), 'success');
				this.fetchAndRender();
			} else {
				showToast(t('toast_delete_error'), 'error');
			}
		} catch (e) {
			showToast(t('toast_connect_error'), 'error');
		}
	},

	handleSort(field) {
		if (state.sortParams.field === field) {
			state.sortParams.direction = state.sortParams.direction === 'asc' ? 'desc' : 'asc';
		} else {
			state.sortParams.field = field;
			state.sortParams.direction = 'desc';
		}
		this.render();
	},

	updateStats() {
		const transactions = state.transactions || [];

		// Initialize balance objects
		let total = { cash: 0, bank: 0 };
		let saving = { cash: 0, bank: 0 };
		let support = { cash: 0, bank: 0 };
		let investment = { cash: 0, bank: 0 };
		let together = { cash: 0, bank: 0 };

		let monthlyIncome = 0;
		let monthlyExpense = 0;

		const getSource = (source) => source === 'bank' ? 'bank' : 'cash';

		transactions.forEach(t => {
			const source = getSource(t.source);
			const amount = convertAmount(t.amount, t.currency || 'VND');

			// --- Monthly Stats ---
			if (t.type === 'income') {
				monthlyIncome += amount;
			} else if (t.type === 'expense') {
				const allocationCategories = ['Saving', 'Support', 'Investment', 'Together'];
				if (!allocationCategories.includes(t.category)) {
					monthlyExpense += amount;
				}
			}

			// --- Balance Logic ---
			if (t.type === 'income') {
				const fundCategories = ['Saving', 'Support', 'Investment', 'Together'];
				if (fundCategories.includes(t.category)) {
					if (t.category === 'Saving') saving[source] += amount;
					else if (t.category === 'Support') support[source] += amount;
					else if (t.category === 'Investment') investment[source] += amount;
					else if (t.category === 'Together') together[source] += amount;
				} else {
					total[source] += amount;
				}
			} else if (t.type === 'expense') {
				if (t.fund) {
					const fundSource = source;
					if (t.fund === 'Saving') saving[fundSource] -= amount;
					else if (t.fund === 'Support') support[fundSource] -= amount;
					else if (t.fund === 'Investment') investment[fundSource] -= amount;
					else if (t.fund === 'Together') together[fundSource] -= amount;
				} else {
					total[source] -= amount;
					// Legacy Allocation via Expense
					if (t.category === 'Saving') saving[source] += amount;
					else if (t.category === 'Support') support[source] += amount;
					else if (t.category === 'Investment') investment[source] += amount;
					else if (t.category === 'Together') together[source] += amount;
				}
			} else if (t.type === 'allocation') {
				const sourceFundCat = ['Saving', 'Support', 'Investment', 'Together'];
				if (sourceFundCat.includes(t.category)) {
					if (t.category === 'Saving') saving[source] -= amount;
					else if (t.category === 'Support') support[source] -= amount;
					else if (t.category === 'Investment') investment[source] -= amount;
					else if (t.category === 'Together') together[source] -= amount;
				} else {
					total[source] -= amount;
				}

				if (t.destination_category) {
					const destSource = getSource(t.destination);
					if (t.destination_category === 'Saving') saving[destSource] += amount;
					else if (t.destination_category === 'Support') support[destSource] += amount;
					else if (t.destination_category === 'Investment') investment[destSource] += amount;
					else if (t.destination_category === 'Together') together[destSource] += amount;
				}
			}
		});

		// Investment Ledger Integration
		const invActivity = { cash: 0, bank: 0 };
		if (state.investments) {
			state.investments.forEach(inv => {
				let impact = 0;
				if (inv.type === 'buy') impact = -1 * ((inv.quantity * inv.price) + (inv.fee || 0));
				else if (inv.type === 'sell') impact = (inv.quantity * inv.price) - (inv.fee || 0) - (inv.tax || 0);
				else if (inv.type === 'dividend') impact = (inv.quantity * inv.price) - (inv.tax || 0);

				invActivity.bank += impact; // Assume bank
			});
		}
		investment.bank += invActivity.bank;
		investment.cash += invActivity.cash;

		// Display Currency
		const targetCurrency = state.currentLanguage === 'vi' ? 'VND' : 'USD';

		// Helper to update text content if element exists
		const updateText = (id, val, currency = targetCurrency) => {
			const el = document.getElementById(id);
			if (el) el.textContent = formatCurrency(val, currency);
		};

		const totalAll = total.cash + total.bank + saving.cash + saving.bank + support.cash + support.bank + investment.cash + investment.bank + together.cash + together.bank;

		updateText('total-balance', totalAll, 'VND'); // The Total Balance is usually in base currency, but let's follow legacy logic which converted everything to display currency? 
		// Wait, legacy: this.elements.totalBalance.textContent = this.formatCurrency(total...);
		// And formatCurrency converts IF from != to.
		// My Logic above converted everything to targetCurrency (USD/VND) already.
		// So I should pass targetCurrency as 'from' so formatCurrency doesn't convert AGAIN.

		updateText('total-balance', totalAll, targetCurrency);
		updateText('balance-cash', total.cash, targetCurrency);
		updateText('balance-bank', total.bank, targetCurrency);

		updateText('monthly-income', monthlyIncome, targetCurrency);
		updateText('monthly-expense', monthlyExpense, targetCurrency);

		updateText('total-saving', saving.cash + saving.bank, targetCurrency);
		updateText('saving-cash', saving.cash, targetCurrency);
		updateText('saving-bank', saving.bank, targetCurrency);

		updateText('total-support', support.cash + support.bank, targetCurrency);
		updateText('support-cash', support.cash, targetCurrency);
		updateText('support-bank', support.bank, targetCurrency);

		updateText('total-investment', investment.cash + investment.bank, targetCurrency);
		updateText('investment-cash', investment.cash, targetCurrency);
		updateText('investment-bank', investment.bank, targetCurrency);

		if (document.getElementById('inv-available-cash')) {
			updateText('inv-available-cash', investment.cash + investment.bank, targetCurrency);
		}

		updateText('total-together', together.cash + together.bank, targetCurrency);
		updateText('together-cash', together.cash, targetCurrency);
		updateText('together-bank', together.bank, targetCurrency);

		state.balances = { total, saving, support, investment, together };
	},

	updateChart() {
		const ctx = document.getElementById('allocation-chart');
		if (!ctx) return;

		const expenses = (state.transactions || []).filter(t => t.type === 'expense');
		const categoryData = {};

		expenses.forEach(t => {
			if (!categoryData[t.category]) categoryData[t.category] = { cash: 0, bank: 0 };
			const source = t.source === 'bank' ? 'bank' : 'cash';
			const amount = convertAmount(t.amount, t.currency || 'VND');
			categoryData[t.category][source] += amount;
		});

		const labels = Object.keys(categoryData).map(cat => getCategoryName(cat));
		const cashData = Object.values(categoryData).map(d => d.cash);
		const bankData = Object.values(categoryData).map(d => d.bank);

		if (state.chart) {
			state.chart.destroy();
		}

		// Check if Chart is defined (global from script tag)
		if (typeof Chart === 'undefined') return;

		state.chart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: labels,
				datasets: [
					{
						label: state.currentLanguage === 'vi' ? 'Tiền mặt' : 'Cash',
						data: cashData,
						backgroundColor: '#4BC0C0',
					},
					{
						label: state.currentLanguage === 'vi' ? 'Ngân hàng' : 'Bank',
						data: bankData,
						backgroundColor: '#36A2EB',
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
				plugins: {
					tooltip: {
						callbacks: {
							label: (context) => {
								let label = context.dataset.label || '';
								if (label) label += ': ';
								if (context.parsed.y !== null) {
									const targetCurrency = state.currentLanguage === 'vi' ? 'VND' : 'USD';
									label += formatCurrency(context.parsed.y, targetCurrency);
								}
								return label;
							}
						}
					}
				}
			}
		});
	}
};
