
import { t } from '../utils.js';

export const Nav = {
	init() {
		const sidebarToggle = document.getElementById('sidebar-toggle');
		const mainSidebar = document.getElementById('main-sidebar');

		if (sidebarToggle && mainSidebar) {
			sidebarToggle.addEventListener('click', () => {
				mainSidebar.classList.toggle('collapsed');
				const isCollapsed = mainSidebar.classList.contains('collapsed');
				localStorage.setItem('parfin_sidebar_collapsed', isCollapsed);
			});

			// Restore state
			const isCollapsed = localStorage.getItem('parfin_sidebar_collapsed') === 'true';
			if (isCollapsed) mainSidebar.classList.add('collapsed');
		}

		const navItems = document.querySelectorAll('.nav-item');
		navItems.forEach(item => {
			item.addEventListener('click', (e) => {
				e.preventDefault();
				this.switchView(item);
			});
		});

		// Load Modals globally once
		this.loadModals();

		// Bind Global Header Actions
		this.bindGlobalActions();
	},

	bindGlobalActions() {
		// We need to wait for modals to load before binding modal-specific buttons?
		// Actually, the buttons to OPEN the modals are in index.html (header), so they exist.
		// The modals themselves are in index.html as placeholders? 
		// No, I moved them to modals.html which is loaded into #modals-container.

		const bindOpenButtons = () => {
			const importBtn = document.getElementById('import-btn');
			const exportBtn = document.getElementById('export-btn');
			const importModal = document.getElementById('import-modal'); // inside modals-container
			const exportModal = document.getElementById('export-modal'); // inside modals-container

			if (importBtn && importModal) {
				importBtn.addEventListener('click', () => importModal.classList.remove('hidden'));
			}
			if (exportBtn && exportModal) {
				exportBtn.addEventListener('click', () => exportModal.classList.remove('hidden'));
			}
		};

		const bindModalInternals = () => {
			// Bind Close/Cancel for Import/Export
			const cancelImport = document.getElementById('cancel-import-btn');
			if (cancelImport) cancelImport.addEventListener('click', () => document.getElementById('import-modal').classList.add('hidden'));

			const cancelExport = document.getElementById('cancel-export-btn');
			if (cancelExport) cancelExport.addEventListener('click', () => document.getElementById('export-modal').classList.add('hidden'));

			// Bind Forms
			const importForm = document.getElementById('import-form');
			if (importForm) importForm.addEventListener('submit', (e) => this.handleImport(e));

			const exportForm = document.getElementById('export-form');
			if (exportForm) exportForm.addEventListener('submit', (e) => this.handleExport(e));
		};

		// Try to bind now (buttons exist)
		// AND bind internals when modals load
		document.addEventListener('modals:loaded', () => {
			bindOpenButtons(); // Bind open buttons only after modals exist? 
			// Actually open buttons are in header (always exist), but they need target (modal) which loads async.
			// So we must wait for modals:loaded to reference the modal element potentially.
			bindOpenButtons();
			bindModalInternals();
		});
	},

	async handleImport(e) {
		e.preventDefault();
		const { Api } = await import('../api.js');
		const { showToast, t } = await import('../utils.js');

		const formData = new FormData(e.target);
		const file = formData.get('file');

		if (!file) return;

		const reader = new FileReader();
		reader.onload = async (evt) => {
			try {
				const content = evt.target.result;
				const isCsv = file.name.endsWith('.csv');
				const format = isCsv ? 'csv' : 'json';

				const result = await Api.importData({ format, data: content });
				if (result.ok) {
					showToast(t('toast_save_success'), 'success');
					document.getElementById('import-modal').classList.add('hidden');
					document.dispatchEvent(new Event('transactions:updated'));
				} else {
					showToast(t('toast_error'), 'error');
				}
			} catch (err) {
				showToast(t('toast_error'), 'error');
			}
		};
		reader.readAsText(file);
	},

	async handleExport(e) {
		e.preventDefault();
		const formData = new FormData(e.target);
		const period = formData.get('period');
		const format = formData.get('format');

		// Construct Link
		let url = `/api/export?format=${format}`;
		if (period === 'current') {
			const month = new Date().toISOString().slice(0, 7);
			url += `&month=${month}`;
		} else {
			url += `&month=all`;
		}

		window.location.href = url;
		document.getElementById('export-modal').classList.add('hidden');
	},

	async loadModals() {
		const container = document.getElementById('modals-container');
		if (container && container.dataset.src && !container.dataset.loaded) {
			try {
				const resp = await fetch(container.dataset.src);
				if (resp.ok) {
					container.innerHTML = await resp.text();
					container.dataset.loaded = "true";
					document.dispatchEvent(new Event('modals:loaded'));
				}
			} catch (e) {
				console.error("Failed to load modals", e);
			}
		}
	},

	async switchView(navItem) {
		const targetId = navItem.dataset.view;
		const navItems = document.querySelectorAll('.nav-item');
		const viewSections = document.querySelectorAll('.view-section');

		// Update Nav UI
		navItems.forEach(item => item.classList.remove('active'));
		navItem.classList.add('active');

		// Load Content if needed
		const section = document.getElementById(targetId);
		if (section && section.dataset.src && !section.dataset.loaded) {
			try {
				section.innerHTML = '<div class="p-4 text-center">Loading...</div>';
				const resp = await fetch(section.dataset.src);
				if (resp.ok) {
					section.innerHTML = await resp.text();
					section.dataset.loaded = "true";
					document.dispatchEvent(new CustomEvent('view:loaded', { detail: { viewId: targetId } }));
				} else {
					section.innerHTML = '<div class="p-4 text-center text-danger">Failed to load content.</div>';
				}
			} catch (e) {
				section.innerHTML = '<div class="p-4 text-center text-danger">Error loading content.</div>';
			}
		} else {
			// Already loaded, just dispatch? or module handles it?
			// If we switch back to monthly, we might want to refresh?
			document.dispatchEvent(new CustomEvent('view:loaded', { detail: { viewId: targetId } }));
		}

		// Update View UI
		viewSections.forEach(sec => {
			if (sec.id === targetId) {
				sec.classList.remove('hidden');
			} else {
				sec.classList.add('hidden');
			}
		});
	},

	restoreActiveView() {
		const activeNav = document.querySelector('.nav-item.active');
		if (activeNav) {
			this.switchView(activeNav);
		} else {
			const first = document.querySelector('.nav-item');
			if (first) this.switchView(first);
		}
	}
};
