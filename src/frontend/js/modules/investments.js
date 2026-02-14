
import { Api } from '../api.js';
import { state } from '../state.js';
import { t, formatCurrency, showToast, convertAmount } from '../utils.js';
import { Transactions } from './transactions.js';

export const Investments = {
	init() {
		console.log('Investments module initialized');
		this.bindEvents();
		this.fetchAndRender();
		document.addEventListener('settings:updated', () => this.fetchAndRender());
	},

	bindEvents() {
		const buyBtn = document.getElementById('btn-invest-buy');
		const sellBtn = document.getElementById('btn-invest-sell');
		const divBtn = document.getElementById('btn-invest-dividend');

		if (buyBtn) buyBtn.addEventListener('click', () => this.openModal('buy'));
		if (sellBtn) sellBtn.addEventListener('click', () => this.openModal('sell'));
		if (divBtn) divBtn.addEventListener('click', () => this.openModal('dividend'));

		const modal = document.getElementById('investment-modal');
		const form = document.getElementById('investment-form');
		const closeBtn = document.getElementById('btn-close-investment-modal');

		if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());

		if (form) {
			form.addEventListener('submit', (e) => this.handleSubmit(e));
		}
	},

	async fetchAndRender() {
		try {
			// Ensure we have transaction stats for Available Cash (which comes from general balances)
			// Although now Logic calculates it, but we might rely on global state.balances
			if (!state.balances) {
				await Transactions.fetchAndRender(); // This fills state.balances
			}

			const currency = state.currentLanguage === 'vi' ? 'VND' : 'USD';

			const [history, portfolio] = await Promise.all([
				Api.getInvestments(),
				Api.getInvestmentPortfolio({ currency })
			]);

			state.investments = history; // Transaction History
			state.portfolio = portfolio; // Holdings & Summary logic from backend

			this.render();
		} catch (e) {
			console.error('Failed to fetch investments', e);
		}
	},

	render() {
		this.renderHistory();
		this.renderPortfolio();
	},

	renderHistory() {
		const tbody = document.getElementById('inv-history-body');
		if (!tbody) return;
		tbody.innerHTML = '';

		const transactions = state.investments || [];
		if (transactions.length === 0) {
			tbody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-secondary">${t('no_transactions')}</td></tr>`;
			return;
		}

		// Data already sorted by backend
		const currentCurrency = state.currentLanguage === 'vi' ? 'VND' : 'USD';

		transactions.forEach(tx => {
			const tr = document.createElement('tr');
			tr.className = 'border-b text-sm hovering-row';
			tr.style.borderColor = 'var(--bg-accent)';

			// History list items are pure transaction records. 
			// Backend sends them as is. Backend 'price' is in stored currency? 
			// No, Logic.py 'calculate_stats' converts them. But 'api/investments' just returns raw rows currently?
			// Let's check server.py: 'SELECT * ...'. It returns raw rows.
			// So we MUST convert them for display if they are not in target currency.
			// Assumption: Investment Transactions stored in base currency or handling needs to be robust. 
			// Current plan: Use client-side convertAmount for HISTORY LIST display consistency with existing UI, 
			// BUT Portfolio table uses backend values.

			const price = convertAmount(tx.price, 'VND');
			const fee = convertAmount(tx.fee || 0, 'VND');
			const tax = convertAmount(tx.tax || 0, 'VND');

			const total = (tx.type === 'buy')
				? (price * tx.quantity) + fee + tax
				: (price * tx.quantity) - fee - tax;

			let typeLabel = t(`inv_type_${tx.type}`);
			let color = 'text-primary';
			if (tx.type === 'buy') color = 'text-danger';
			if (tx.type === 'sell' || tx.type === 'dividend') color = 'text-success';

			tr.innerHTML = `
                <td class="p-4">
                    <input type="checkbox" class="accent-primary cursor-pointer w-4 h-4">
                </td>
                <td class="p-4">${new Date(tx.date).toLocaleDateString()}</td>
                <td class="p-4">
					<div class="flex items-center gap-sm">
                         <span class="text-lg w-8 h-8 flex items-center justify-center rounded-full bg-secondary bg-opacity-50"><i class="fa-solid fa-sack-dollar"></i></span>
                         <span class="capitalize font-medium">${t(`asset_type_${tx.asset_type}`)}</span>
                    </div>
                </td>
                <td class="p-4 font-bold">${tx.symbol}</td>
                <td class="p-4">
                    <span class="badge ${color === 'text-danger' ? 'badge-warning' : 'badge-success'} bg-opacity-10" style="font-size: 0.75rem;">${typeLabel}</span>
                </td>
                <td class="p-4 text-right">${tx.quantity}</td>
                <td class="p-4 text-right">${formatCurrency(price, currentCurrency)}</td>
                <td class="p-4 text-right font-bold">${formatCurrency(total, currentCurrency)}</td>
                <td class="p-4">
                    <button class="btn-icon delete-btn text-secondary hover:text-danger" data-id="${tx.id}"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;

			tr.querySelector('.delete-btn').addEventListener('click', () => this.handleDelete(tx.id));
			tbody.appendChild(tr);
		});
	},

	renderPortfolio() {
		const tbody = document.getElementById('holdings-list-body');
		if (!tbody) return;
		tbody.innerHTML = '';

		// Use Backend Portfolio Data
		const portfolio = state.portfolio || { holdings: [], summary: {} };
		const activeHoldings = portfolio.holdings;
		const summary = portfolio.summary;
		const currentCurrency = state.currentLanguage === 'vi' ? 'VND' : 'USD';

		if (!activeHoldings || activeHoldings.length === 0) {
			tbody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-secondary">${t('no_holdings')}</td></tr>`;
			this.updateHeroStats(summary);
			return;
		}

		activeHoldings.forEach(h => {
			const tr = document.createElement('tr');
			tr.className = 'border-b text-sm';
			tr.style.borderColor = 'var(--bg-accent)';

			// Format Values (Backend provides them in requested currency)
			const fmt = (val) => {
				const locale = state.currentLanguage === 'vi' ? 'vi-VN' : 'en-US';
				return new Intl.NumberFormat(locale, { style: 'currency', currency: currentCurrency }).format(val);
			}

			tr.innerHTML = `
                <td class="p-4">
                    <input type="checkbox" class="accent-primary cursor-pointer w-4 h-4">
                </td>
                <td class="p-4">
                    <div class="flex items-center gap-sm">
                         <span class="text-lg w-8 h-8 flex items-center justify-center rounded-full bg-secondary bg-opacity-50"><i class="fa-solid fa-chart-line"></i></span>
                         <span class="capitalize font-medium">${t(`asset_type_${h.asset_type}`)}</span>
                    </div>
                </td>
                <td class="p-4 font-bold">${h.symbol}</td>
                <td class="p-4 text-right">${h.quantity.toFixed(2)}</td>
                <td class="p-4 text-right">${fmt(h.avg_price)}</td>
                <td class="p-4 text-right">${fmt(h.market_price)}</td>
                <td class="p-4 text-right font-bold">${fmt(h.total_value)}</td>
                <td class="p-4 text-right ${h.pl_percent >= 0 ? 'text-success' : 'text-danger'}">${h.pl_percent.toFixed(2)}%</td>
             `;
			tbody.appendChild(tr);
		});

		this.updateHeroStats(summary);
	},

	updateHeroStats(summary) {
		const currentCurrency = state.currentLanguage === 'vi' ? 'VND' : 'USD';

		const fmt = (val) => {
			const locale = state.currentLanguage === 'vi' ? 'vi-VN' : 'en-US';
			return new Intl.NumberFormat(locale, { style: 'currency', currency: currentCurrency }).format(val);
		}

		if (!summary) return;

		document.getElementById('inv-total-invested').textContent = fmt(summary.total_invested || 0);
		document.getElementById('inv-current-value').textContent = fmt(summary.total_current_value || 0);

		const plPercent = summary.total_pl_percent || 0;
		const pl = (summary.total_current_value || 0) - (summary.total_invested || 0);

		const plEl = document.getElementById('inv-total-pl');
		plEl.textContent = `${plPercent.toFixed(2)}%`;
		plEl.className = pl >= 0 ? 'text-success' : 'text-danger';

		// Available Cash: Comes from Global Balances (fetched via transactions module)
		// Or we can use the net_cash_flow? 
		// Actually best is to trust the Real Investment Fund Balance from 'balances'
		let investmentBalance = 0;
		if (state.balances && state.balances.investment) {
			investmentBalance = (state.balances.investment.cash || 0) + (state.balances.investment.bank || 0);
		}

		const availableEl = document.getElementById('inv-available-cash');
		if (availableEl) {
			availableEl.textContent = fmt(investmentBalance);
			availableEl.className = investmentBalance >= 0 ? 'text-success text-xl' : 'text-danger text-xl';
		}
	},

	openModal(type) {
		const modal = document.getElementById('investment-modal');
		const form = document.getElementById('investment-form');
		const title = document.getElementById('inv-modal-title');
		const taxGroup = document.getElementById('inv-tax-group');
		const qtyGroup = document.getElementById('inv-qty-group');
		const priceGroup = document.getElementById('inv-price-group');

		form.reset();
		document.getElementById('inv-type').value = type;
		form.querySelector('input[name="date"]').valueAsDate = new Date();

		if (type === 'buy') {
			title.textContent = t('buy_stock_btn');
			taxGroup.classList.add('hidden');
			qtyGroup.classList.remove('hidden');
			priceGroup.classList.remove('hidden');
		} else if (type === 'sell') {
			title.textContent = t('sell_stock_btn');
			taxGroup.classList.remove('hidden');
			qtyGroup.classList.remove('hidden');
			priceGroup.classList.remove('hidden');
		} else if (type === 'dividend') {
			title.textContent = t('record_dividend_btn');
			taxGroup.classList.remove('hidden');
			qtyGroup.classList.add('hidden');
			priceGroup.classList.remove('hidden');
			form.querySelector('input[name="quantity"]').value = 1;
			document.querySelector('#inv-price-group label').textContent = t('total_amount_label');
		}

		if (type !== 'dividend') {
			document.querySelector('#inv-price-group label').textContent = t('price_per_share_label');
		}

		modal.classList.remove('hidden');
	},

	closeModal() {
		document.getElementById('investment-modal').classList.add('hidden');
	},

	async handleSubmit(e) {
		e.preventDefault();
		const formData = new FormData(e.target);
		const data = Object.fromEntries(formData.entries());
		data.user_id = 1;

		// Prepare numbers
		data.quantity = parseFloat(data.quantity) || 0;
		data.price = parseFloat(data.price) || 0;
		data.fee = parseFloat(data.fee) || 0;
		data.tax = parseFloat(data.tax) || 0;

		try {
			const res = await Api.saveInvestment(data);
			if (res) {
				showToast(t('toast_save_success'), 'success');
				this.closeModal();
				this.fetchAndRender();
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
			const ok = await Api.deleteInvestment(id);
			if (ok) {
				showToast(t('toast_delete_success'), 'success');
				this.fetchAndRender();
			}
		} catch (e) {
			showToast(t('toast_error'), 'error');
		}
	}
};
