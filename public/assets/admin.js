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
            // unify on uiTheme key used across pages
            const theme = localStorage.getItem('uiTheme') || localStorage.getItem('theme') || 'light';
			document.documentElement.classList.remove('theme-semi','theme-dark');
			if(theme==='semi') document.documentElement.classList.add('theme-semi');
			if(theme==='dark') document.documentElement.classList.add('theme-dark');
		},
        setTheme(theme){ localStorage.setItem('uiTheme', theme); localStorage.setItem('theme', theme); this.applyTheme(); }
	};
	// apply theme on load
    window.Admin.applyTheme();
})();

// Lightweight client-side credential vault using XOR with JWT for obfuscation (not cryptographically strong)
(function(){
    function xorStr(data, key){
        if(!data || !key) return data;
        let out='';
        for(let i=0;i<data.length;i++) out += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        return out;
    }
    function getKey(){ try{ return localStorage.getItem('token') || ''; }catch(_){ return ''; } }
    window.CredVault = {
        save(email, password){
            try{
                const key = getKey();
                const payload = JSON.stringify({ e: email, p: password });
                const obf = btoa(xorStr(payload, key));
                localStorage.setItem('mailCreds', obf);
            }catch(_){ }
        },
        load(){
            try{
                const key = getKey();
                const obf = localStorage.getItem('mailCreds');
                if(!obf) return null;
                const json = xorStr(atob(obf), key);
                const obj = JSON.parse(json);
                return { email: obj.e, password: obj.p };
            }catch(_){ return null; }
        },
        clear(){ try{ localStorage.removeItem('mailCreds'); }catch(_){ }
        }
    };
})();
