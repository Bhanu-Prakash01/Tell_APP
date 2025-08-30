// Shared Admin JS (Frappe-styled admin)
(function(){
	window.Admin = {
		getToken(){ return localStorage.getItem('token'); },
		authHeaders(){ const t=this.getToken(); return t?{ 'Authorization': `Bearer ${t}` }:{}; },
		qs(sel,root=document){ return root.querySelector(sel); },
		qsa(sel,root=document){ return Array.from(root.querySelectorAll(sel)); },
		fmtDate(d){ try{ return new Date(d).toLocaleDateString(); }catch(e){ return '-'; } },
		navActivate(path){
			Admin.qsa('.admin-sidebar nav a').forEach(a=>{
				const isActive = a.getAttribute('href')===path;
				if(isActive) a.classList.add('active'); else a.classList.remove('active');
			});
		},
		applyTheme(){
			const theme = localStorage.getItem('theme') || 'light';
			document.documentElement.classList.remove('theme-semi','theme-dark');
			if(theme==='semi') document.documentElement.classList.add('theme-semi');
			if(theme==='dark') document.documentElement.classList.add('theme-dark');
		},
		setTheme(theme){ localStorage.setItem('theme', theme); this.applyTheme(); }
	};
	// apply theme on load
    window.Admin.applyTheme();
})();
