
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
		document.addEventListener('settings:updated', () => {
			this.updateStats(); // Recalculate balances with new rate/currency
			this.render();
		});
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
				toggleBtn.innerHTML = '<i class="fa-solid fa-lock"></i>';
			} else {
				toggleBtn.innerHTML = '<i class="fa-regular fa-eye"></i>';
			}

			// Prevent duplicate binding
			if (toggleBtn.dataset.bound) return;

			toggleBtn.addEventListener('click', () => {
				const isHidden = chartContainer.classList.contains('hidden');
				if (isHidden) {
					chartContainer.classList.remove('hidden');
					toggleBtn.innerHTML = '<i class="fa-regular fa-eye"></i>';
					this.updateChart();
				} else {
					chartContainer.classList.add('hidden');
					toggleBtn.innerHTML = '<i class="fa-solid fa-lock"></i>';
				}
				localStorage.setItem('parfin_chart_visible', !isHidden);
			});
			toggleBtn.dataset.bound = "true";
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
		// Filter Elements
		const filterPeriod = document.getElementById('filter-period');
		const filterCustomDates = document.getElementById('filter-custom-dates');
		const filterStartDate = document.getElementById('filter-start-date');
		const filterEndDate = document.getElementById('filter-end-date');
		const filterCategory = document.getElementById('filter-category');

		// Only bind if filterPeriod exists and hasn't been bound
		if (filterPeriod && !filterPeriod.dataset.bound) {
			filterPeriod.value = state.filterParams.period || 'this_month';
			filterPeriod.addEventListener('change', (e) => {
				console.log('Filter changed:', e.target.value);
				const period = e.target.value;
				state.filterParams.period = period;
				this.updateFilterUI();
				this.fetchAndRender();
			});
			filterPeriod.dataset.bound = "true";
		}

		// Populate Categories
		if (filterCategory && !filterCategory.dataset.populated) {
			const categories = ['Salary', 'Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Debt', 'Personal', 'Saving', 'Support', 'Investment', 'Other'];
			filterCategory.innerHTML = '<option value="all" data-i18n="filter_all_categories">All Categories</option>';
			categories.forEach(cat => {
				const option = document.createElement('option');
				option.value = cat;
				option.textContent = getCategoryName(cat);
				filterCategory.appendChild(option);
			});
			// Restore value
			if (state.filterParams.category) filterCategory.value = state.filterParams.category;

			filterCategory.addEventListener('change', (e) => {
				console.log('Category changed:', e.target.value);
				state.filterParams.category = e.target.value;
				this.fetchAndRender();
			});
			filterCategory.dataset.populated = "true";
		}

		const dateChangeHandler = () => {
			console.log('Custom dates changed');
			state.filterParams.startDate = filterStartDate.value;
			state.filterParams.endDate = filterEndDate.value;
			this.fetchAndRender();
		};

		if (filterStartDate && !filterStartDate.dataset.bound) {
			filterStartDate.addEventListener('change', dateChangeHandler);
			filterStartDate.dataset.bound = "true";
		}
		if (filterEndDate && !filterEndDate.dataset.bound) {
			filterEndDate.addEventListener('change', dateChangeHandler);
			filterEndDate.dataset.bound = "true";
		}

		// Initial UI State
		this.updateFilterUI();

		// Sorting
		document.querySelectorAll('th[data-sort]').forEach(th => {
			if (!th.dataset.bound) {
				th.addEventListener('click', () => {
					this.handleSort(th.dataset.sort);
				});
				th.dataset.bound = "true";
			}
		});
	},

	updateFilterUI() {
		const filterPeriod = document.getElementById('filter-period');
		const filterCustomDates = document.getElementById('filter-custom-dates');

		// Check if elements exist before trying to access classList
		if (!filterCustomDates) return;

		if (state.filterParams.period === 'custom') {
			filterCustomDates.classList.remove('hidden');
		} else {
			filterCustomDates.classList.add('hidden');
		}
	},

	async fetchAndRender() {
		await this.fetchTransactions();
		this.render();
		this.updateChart();
	},

	async fetchTransactions() {
		console.log('Fetching transactions with params:', state.filterParams);
		try {
			// Calculate Dates based on Period
			const params = { ...state.filterParams };
			const period = params.period || 'this_month';
			const today = new Date();

			const formatDate = (date) => {
				const offset = date.getTimezoneOffset();
				const localDate = new Date(date.getTime() - (offset * 60 * 1000));
				return localDate.toISOString().split('T')[0];
			};

			if (period === 'this_month') {
				const start = new Date(today.getFullYear(), today.getMonth(), 1);
				const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
				params.start_date = formatDate(start);
				params.end_date = formatDate(end);
			} else if (period === 'last_month') {
				const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
				const end = new Date(today.getFullYear(), today.getMonth(), 0);
				params.start_date = formatDate(start);
				params.end_date = formatDate(end);
			} else if (period === 'this_year') {
				const start = new Date(today.getFullYear(), 0, 1);
				const end = new Date(today.getFullYear(), 11, 31);
				params.start_date = formatDate(start);
				params.end_date = formatDate(end);
			} else if (period === 'last_year') {
				const start = new Date(today.getFullYear() - 1, 0, 1);
				const end = new Date(today.getFullYear() - 1, 11, 31);
				params.start_date = formatDate(start);
				params.end_date = formatDate(end);
			} else if (period === 'custom') {
				params.start_date = params.startDate;
				params.end_date = params.endDate;
			}
			// If 'all', no date params sent

			console.log('Computed API params:', params);

			const data = await Api.getTransactions(params);
			state.transactions = data;

			// Dispatch event for other modules (Stats, Charts)
			document.dispatchEvent(new Event('transactions:updated'));
			this.updateStats();
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
				icon.innerHTML = direction === 'asc' ? ' <i class="fa-solid fa-sort-up"></i>' : ' <i class="fa-solid fa-sort-down"></i>';
				th.classList.add('text-primary');
			} else {
				icon.innerHTML = '';
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

			const sourceClass = transaction.source === 'bank' ? 'badge-info' : 'badge-success';
			// Badge-like appearance for Source
			const sourceBadge = `<span class="badge ${sourceClass} bg-opacity-10" style="font-size: 0.75rem;">${sourceName}</span>`;

			tr.innerHTML = `
                <td class="p-4">
                    <input type="checkbox" class="accent-primary cursor-pointer w-4 h-4">
                </td>
                <td class="p-4 font-medium">${new Date(transaction.date).toLocaleDateString(locale)}</td>
                <td class="p-4">
                    <div class="flex items-center gap-sm">
                        <span class="text-lg w-8 h-8 flex items-center justify-center rounded-full bg-secondary bg-opacity-50">${getCategoryIcon(transaction.category)}</span>
                        <span class="font-medium">${categoryName}</span>
                    </div>
                </td>
                <td class="p-4 text-secondary">${transaction.description || '-'}</td>
                <td class="p-4 text-right font-bold ${colorClass}">${sign} ${formatCurrency(transaction.amount, transaction.currency)}</td>
                <td class="p-4">
                    <div class="flex items-center gap-sm">
                        ${sourceBadge}
                        ${destName ? '<span class="text-xs text-secondary">' + destName + '</span>' : ''}
                        ${fundBadge}
                    </div>
                </td>
                <td class="p-4">
                    <button class="btn-icon edit-btn text-secondary hover:text-primary"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-icon delete-btn text-secondary hover:text-danger"><i class="fa-solid fa-trash"></i></button>
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

		if (transaction.type === 'allocation') {
			form.dataset.targetDestCategory = transaction.destination_category || '';
		}

		// Update form state (rebuilds options) BEFORE setting values
		this.updateFormState();

		form.category.value = transaction.category;
		form.description.value = transaction.description || '';
		form.date.value = transaction.date;
		form.source.value = transaction.source || 'cash';
		form.fund.value = transaction.fund || '';

		if (transaction.type === 'allocation') {
			form.destination.value = transaction.destination || 'bank';
		}

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
			sourceSection.classList.add('modal-section'); // Add border
			sourceTitle.classList.remove('hidden');
			sourceTitle.textContent = t('source_from_title');

			destGroup.classList.remove('hidden');
			destGroup.classList.add('modal-section'); // Add border
		} else {
			sourceSection.classList.remove('source-section');
			sourceSection.classList.remove('modal-section'); // Remove border
			sourceTitle.textContent = t('source_details_title');

			destGroup.classList.add('hidden');
			destGroup.classList.remove('modal-section'); // Remove border
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

			destSelect.innerHTML = `<option value="" disabled selected>${t('select_destination_category')}</option>`;
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
		let monthlyIncomeStats = { cash: 0, bank: 0 };
		let monthlyExpense = 0;
		let monthlyExpenseStats = { cash: 0, bank: 0 };

		const getSource = (source) => source === 'bank' ? 'bank' : 'cash';

		transactions.forEach(t => {
			const source = getSource(t.source);
			const amount = convertAmount(t.amount, t.currency || 'VND');

			// --- Monthly Stats ---
			if (t.type === 'income') {
				monthlyIncome += amount;
				monthlyIncomeStats[source] += amount;
			} else if (t.type === 'expense') {
				const allocationCategories = ['Saving', 'Support', 'Investment', 'Together'];
				if (!allocationCategories.includes(t.category)) {
					monthlyExpense += amount;
					monthlyExpenseStats[source] += amount;
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
					else {
						total[destSource] += amount;
					}
				}
			}
		});

		// Investment Ledger Integration
		const invActivity = { cash: 0, bank: 0 };
		if (state.investments) {
			state.investments.forEach(inv => {
				const price = convertAmount(inv.price, 'VND');
				const fee = convertAmount(inv.fee || 0, 'VND');
				const tax = convertAmount(inv.tax || 0, 'VND');

				let impact = 0;
				if (inv.type === 'buy') impact = -1 * ((inv.quantity * price) + fee);
				else if (inv.type === 'sell') impact = (inv.quantity * price) - fee - tax;
				else if (inv.type === 'dividend') impact = (inv.quantity * price) - tax;

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

		updateText('total-balance', totalAll, targetCurrency);
		updateText('balance-cash', total.cash, targetCurrency);
		updateText('balance-bank', total.bank, targetCurrency);

		updateText('monthly-income', monthlyIncome, targetCurrency);
		updateText('income-cash', monthlyIncomeStats.cash, targetCurrency);
		updateText('income-bank', monthlyIncomeStats.bank, targetCurrency);
		updateText('monthly-expense', monthlyExpense, targetCurrency);
		updateText('expense-cash', monthlyExpenseStats.cash, targetCurrency);
		updateText('expense-bank', monthlyExpenseStats.bank, targetCurrency);

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
