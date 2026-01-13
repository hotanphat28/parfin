
import { Api } from '../api.js';
import { state } from '../state.js';
import { t, formatCurrency, showToast } from '../utils.js';

export const Investments = {
	init() {
		console.log('Investments module initialized');
		// This is called when View is loaded. 
		// We need to fetch data and bind events.

		this.bindEvents();
		this.fetchAndRender();
		document.addEventListener('settings:updated', () => this.render());
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

		// Dynamically show tax field if type is sell
		// We handle this in openModal
	},

	async fetchAndRender() {
		try {
			const data = await Api.getInvestments();
			state.investments = data;
			this.render();
		} catch (e) {
			console.error('Failed to fetch investments', e);
		}
	},

	render() {
		this.renderHistory();
		this.renderPortfolio();
		this.renderStats();
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

		// Sort by date desc (Api supposedly does this, but being safe)
		transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

		transactions.forEach(tx => {
			const tr = document.createElement('tr');
			tr.className = 'border-b text-sm hovering-row';
			tr.style.borderColor = 'var(--bg-accent)';

			const total = (tx.type === 'buy')
				? (tx.price * tx.quantity) + (tx.fee || 0) + (tx.tax || 0)
				: (tx.price * tx.quantity) - (tx.fee || 0) - (tx.tax || 0); // Sell revenue net

			let typeLabel = tx.type.toUpperCase();
			let color = 'text-primary';
			if (tx.type === 'buy') color = 'text-danger'; // Money out
			if (tx.type === 'sell' || tx.type === 'dividend') color = 'text-success'; // Money in

			tr.innerHTML = `
                <td class="p-4">${new Date(tx.date).toLocaleDateString()}</td>
                <td class="p-4 capitalize">${tx.asset_type || 'stock'}</td>
                <td class="p-4 font-bold">${tx.symbol}</td>
                <td class="p-4 ${color}">${typeLabel}</td>
                <td class="p-4 text-right">${tx.quantity}</td>
                <td class="p-4 text-right">${formatCurrency(tx.price)}</td>
                <td class="p-4 text-right font-bold">${formatCurrency(total)}</td>
                <td class="p-4 text-right">
                    <button class="btn-icon delete-btn" data-id="${tx.id}">🗑️</button>
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

		// Calculate holdings
		const holdings = {}; // { Symbol: { quantity, totalCost, assetType } }

		(state.investments || []).forEach(tx => {
			if (!holdings[tx.symbol]) {
				holdings[tx.symbol] = { quantity: 0, totalCost: 0, assetType: tx.asset_type || 'stock' };
			}

			if (tx.type === 'buy') {
				holdings[tx.symbol].quantity += tx.quantity;
				holdings[tx.symbol].totalCost += (tx.price * tx.quantity) + (tx.fee || 0);
			} else if (tx.type === 'sell') {
				// Determine Cost Basis (FIFO or Average). Let's use Average Cost for simplicity.
				// If we sell, we reduce quantity. We also reduce Total Cost proportionally? 
				// Or we separate Realized P/L? 
				// For "Current Portfolio", we just care about remaining Qty and remaining Cost Basis.
				const currentAvgCost = holdings[tx.symbol].totalCost / holdings[tx.symbol].quantity;
				holdings[tx.symbol].quantity -= tx.quantity;
				holdings[tx.symbol].totalCost -= (currentAvgCost * tx.quantity);
			}
		});

		const activeHoldings = Object.entries(holdings).filter(([_, h]) => h.quantity > 0.0001);

		if (activeHoldings.length === 0) {
			tbody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-secondary">${t('no_holdings')}</td></tr>`;
			return;
		}

		let totalInvested = 0;
		let totalCurrentValue = 0;

		activeHoldings.forEach(([symbol, h]) => {
			const avgPrice = h.totalCost / h.quantity;
			const mktPrice = avgPrice; // MOCK: Assume market price = avg price for now (no live data)
			const totalValue = mktPrice * h.quantity;
			const pl = 0;
			const plPercent = 0;

			totalInvested += h.totalCost;
			totalCurrentValue += totalValue;

			const tr = document.createElement('tr');
			tr.className = 'border-b text-sm';
			tr.style.borderColor = 'var(--bg-accent)';

			tr.innerHTML = `
                <td class="p-4 capitalize">${h.assetType}</td>
                <td class="p-4 font-bold">${symbol}</td>
                <td class="p-4 text-right">${h.quantity.toFixed(2)}</td>
                <td class="p-4 text-right">${formatCurrency(avgPrice)}</td>
                <td class="p-4 text-right">${formatCurrency(mktPrice)}</td>
                <td class="p-4 text-right font-bold">${formatCurrency(totalValue)}</td>
                <td class="p-4 text-right ${pl >= 0 ? 'text-success' : 'text-danger'}">${plPercent.toFixed(2)}%</td>
             `;
			tbody.appendChild(tr);
		});

		// Update Hero Stats
		this.updateHeroStats(totalInvested, totalCurrentValue);
	},

	renderStats() {
		// Updated in renderPortfolio for now
	},

	updateHeroStats(invested, current) {
		document.getElementById('inv-total-invested').textContent = formatCurrency(invested);
		document.getElementById('inv-current-value').textContent = formatCurrency(current);
		const pl = current - invested;
		const plPercent = invested > 0 ? (pl / invested) * 100 : 0;

		const plEl = document.getElementById('inv-total-pl');
		plEl.textContent = `${plPercent.toFixed(2)}%`;
		plEl.className = pl >= 0 ? 'text-success' : 'text-danger';
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

		// Defaults
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
			// Hide Quantity? Dividend usually cash. 
			// Or Keep quantity if it's stock dividend? Assume Cash Dividend for now.
			qtyGroup.classList.add('hidden');
			priceGroup.classList.remove('hidden'); // Use price as "Total Amount" or just amount?
			// Form has 'price' and 'quantity'. For dividend, let's treat 'price' as total amount received, qty = 1.
			form.querySelector('input[name="quantity"]').value = 1;
			// Update label? 
			// Simplified: Dividend = Amount (Price) - Tax.
			document.querySelector('#inv-price-group label').textContent = "Total Amount";
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
