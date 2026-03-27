// --- POSTHOG ANALYTICS ENGINE ---
!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

// INJECT YOUR KEY HERE:
posthog.init('phc_aJprBgaTGl760gpRmqZ1tADeFPHAilFnfylJY8xsQUw', {
    api_host: 'https://us.i.posthog.com',
    person_profiles: 'identified_only' // Keeps it lean and free
});

// Our global wrapper now sends data to the cloud!
window.trackEvent = function(eventName, properties = {}) {
    posthog.capture(eventName, properties);
    console.log(`📊 [PostHog Sent]: ${eventName}`, properties); 
};

let allSignals = [];
let currentFilter = 'All';

// --- LOCAL STORAGE (SWIPE FILE) ---
let savedSignals = JSON.parse(localStorage.getItem('savedSignals') || '[]');

function toggleSaveSignal(id) {
    if (savedSignals.includes(id)) {
        savedSignals = savedSignals.filter(savedId => savedId !== id);
        window.trackEvent('unsave_signal', { signal_id: id });
    } else {
        savedSignals.push(id);
        window.trackEvent('save_signal', { signal_id: id });
    }
    localStorage.setItem('savedSignals', JSON.stringify(savedSignals));
    filterFeed(currentFilter); 
}

// --- CORE FEED LOGIC ---
function timeSince(dateString) {
    // Force JS to read the timestamp as UTC by appending 'Z'
    if (!dateString.endsWith('Z')) dateString += 'Z'; 
    
    const date = new Date(dateString);
    let seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 0) seconds = 1; // Failsafe: if the clocks are off by a few seconds, say "1m ago" instead of negative
    
    let interval = seconds / 3600;
    if (interval > 24) return Math.floor(interval / 24) + "d ago";
    if (interval >= 1) return Math.floor(interval) + "h ago";
    return Math.floor(seconds / 60) + "m ago";
}

function shareToWhatsApp(id, location, category) {
    window.trackEvent('share_whatsapp', { signal_id: id, location: location, category: category });
    const signal = allSignals.find(s => s.id === id);
    if (!signal) return;

    let impactEmoji = signal.impact === 'Positive' ? '🟢' : (signal.impact === 'Negative' ? '🔴' : '⚪');
    let catEmoji = '📊';
    const cat = signal.category.toLowerCase();
    if(cat.includes('infra') || cat.includes('metro')) catEmoji = '🚇';
    else if(cat.includes('zon')) catEmoji = '🏗️';
    else if(cat.includes('commer') || cat.includes('leas')) catEmoji = '🏢';
    else if(cat.includes('resid')) catEmoji = '🏘️';
    else if(cat.includes('polic')) catEmoji = '📜';

    const text = `${impactEmoji} *${signal.impact} Signal: ${signal.location}*\n${catEmoji} Category: ${signal.category}\n\n"${signal.summary}"\n\n🔗 Source: ${signal.sourceUrl}\n📊 *Powered by AcreSignals*`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
}

async function fetchSignals() {
    const container = document.getElementById('signals-list');
    if(!container) return;
    container.innerHTML = '<div class="text-center py-10 text-primary-fixed-dim font-bold text-[10px] uppercase tracking-widest animate-pulse">Establishing Connection...</div>';
    
    try {
        const response = await fetch('/api/signals');
        const dbSignals = await response.json();
        
        allSignals = dbSignals.map(signal => ({
            id: signal.id,
            date: timeSince(signal.published_at),
            headline: signal.headline || "Market Update", // Fallback for old DB entries
            location: signal.location,
            category: signal.category,
            impact: signal.impact,
            summary: signal.summary,
            sourceUrl: signal.source_url
        }));
        
        const syncStatus = document.getElementById('sync-status');
        if(syncStatus) syncStatus.innerHTML = '<span class="material-symbols-outlined text-[16px] text-primary">check</span>';
        
        filterFeed(currentFilter); 
    } catch (error) {
        container.innerHTML = `<div class="text-center py-10 text-bearish font-bold text-[10px] uppercase tracking-widest w-full col-span-full">Connection Terminated. Check Server.</div>`;
    }
}

// --- THE CONTEXT MATRIX ---
function getMarketContext(impact, category) {
    const cat = category.toLowerCase();
    if (impact === 'Positive') {
        if (cat.includes('infra') || cat.includes('expressway') || cat.includes('airport')) return 'Value Unlock / Catalyst';
        if (cat.includes('resid')) return 'Buyer Advantage / Appreciation';
        if (cat.includes('commer') || cat.includes('leas') || cat.includes('office')) return 'Yield Growth';
        if (cat.includes('polic') || cat.includes('rera') || cat.includes('auth')) return 'Pro-Market / Transparency';
        return 'Bullish Indicator';
    } else if (impact === 'Negative') {
        if (cat.includes('infra')) return 'Execution Delay / Headwind';
        if (cat.includes('resid')) return 'Pricing Pressure / Supply Risk';
        if (cat.includes('commer')) return 'Vacancy Risk';
        if (cat.includes('polic') || cat.includes('rera') || cat.includes('auth') || cat.includes('tax')) return 'Developer Risk / Compliance';
        return 'Market Friction';
    } else {
        return 'Stable Holding';
    }
}

function renderFeed(data) {
    const container = document.getElementById('signals-list');
    if(!container) return;
    container.innerHTML = ''; 

    if (data.length === 0) {
        container.innerHTML = `<div class="text-center py-10 text-primary-fixed-dim font-bold text-[10px] uppercase tracking-widest w-full col-span-full">No Signals Found.</div>`;
        return;
    }

    data.forEach(signal => {
        // 1. Structural Styling
        let impactClass = signal.impact === 'Positive' ? 'impact-positive' : (signal.impact === 'Negative' ? 'impact-negative' : 'impact-neutral');
        
        // 2. Generate Smart Sentiment
        let smartSentiment = getMarketContext(signal.impact, signal.category);
        let chipColors = signal.impact === 'Positive' ? 'bg-[#059669]/10 text-[#059669]' : (signal.impact === 'Negative' ? 'bg-[#dc2626]/10 text-[#dc2626]' : 'bg-[#71717a]/10 text-[#71717a]');
        let iconName = signal.impact === 'Positive' ? 'trending_up' : (signal.impact === 'Negative' ? 'warning' : 'horizontal_rule');
        
        // 3. Text Formatting
        let sentences = signal.summary.split('. ').filter(s => s.trim().length > 0);
        let bullet1 = sentences[0] ? sentences[0] + (sentences[0].endsWith('.') ? '' : '.') : '';
        let bullet2 = sentences[1] ? sentences[1] + (sentences[1].endsWith('.') ? '' : '.') : '';

        const isSaved = savedSignals.includes(signal.id);

        const cardHTML = `
            <article class="group relative flex bg-surface-container-lowest border border-transparent hover:border-outline-variant/30 transition-all duration-300 shadow-ambient signal-card opacity-0 translate-y-8 break-inside-avoid mb-8">
                <div class="w-1.5 h-auto ${impactClass} flex-shrink-0"></div>
                <div class="flex-1 p-6 flex flex-col gap-4">
                    
                    <div class="flex flex-wrap items-center gap-3 mb-1">
                        <span class="px-2 py-1 rounded-sm text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 ${chipColors}">
                            <span class="material-symbols-outlined text-[12px]">${iconName}</span>
                            ${smartSentiment}
                        </span>
                        <span class="font-body text-[10px] font-bold uppercase tracking-wider text-outline-variant">${signal.category} • ${signal.location}</span>
                        <span class="ml-auto text-[10px] text-outline-variant italic">${signal.date}</span>
                    </div>
                    
                    <h2 class="font-headline text-3xl font-bold mb-2 group-hover:underline underline-offset-4 decoration-1 text-primary leading-tight">${signal.headline}</h2>
                    
                    <ul class="space-y-3 mb-4">
                        ${bullet1 ? `<li class="flex items-start gap-3"><span class="w-1 h-1 rounded-full bg-primary mt-2 flex-shrink-0"></span><p class="text-on-surface-variant text-sm leading-relaxed">${bullet1}</p></li>` : ''}
                        ${bullet2 ? `<li class="flex items-start gap-3"><span class="w-1 h-1 rounded-full bg-primary mt-2 flex-shrink-0"></span><p class="text-on-surface-variant text-sm leading-relaxed">${bullet2}</p></li>` : ''}
                    </ul>
                    
                    <div class="mt-auto pt-4 flex justify-between items-center border-t border-outline-variant/20">
                        <div class="flex gap-4">
                            <button onclick="shareToWhatsApp(${signal.id}, '${signal.location}', '${signal.category}')" class="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary hover:text-[#25D366] uppercase tracking-widest transition-colors">
                                <span class="material-symbols-outlined text-[14px]">share</span> Share
                            </button>
                            <button onclick="toggleSaveSignal(${signal.id})" class="inline-flex items-center gap-1 text-[10px] font-bold ${isSaved ? 'text-primary' : 'text-outline-variant hover:text-primary'} uppercase tracking-widest transition-colors">
                                <span class="material-symbols-outlined text-[14px] ${isSaved ? 'fill-current' : ''}">bookmark</span> ${isSaved ? 'Saved' : 'Save'}
                            </button>
                        </div>
                        <a href="${signal.sourceUrl}" target="_blank" class="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary border-b border-primary/10 hover:border-primary transition-all py-1">
                            Source <span class="material-symbols-outlined text-sm">arrow_forward</span>
                        </a>
                    </div>
                </div>
            </article>
        `;
        container.insertAdjacentHTML('beforeend', cardHTML);
    });

    observeCards();
}

// --- NEW: SCROLL ANIMATION ENGINE ---
function observeCards() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Smoothly fade up when they enter the screen
                entry.target.classList.remove('opacity-0', 'translate-y-8');
                entry.target.classList.add('opacity-100', 'translate-y-0');
                observer.unobserve(entry.target); // Stop tracking once shown
            }
        });
    }, { threshold: 0.1 }); // Triggers when 10% of the card is visible

    document.querySelectorAll('.signal-card').forEach(card => observer.observe(card));
}

function filterFeed(location) {
    currentFilter = location; 
    if(location !== 'All') window.trackEvent('filter_used', { filter_type: location });

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('bg-primary', 'text-white');
        btn.classList.add('bg-secondary-container', 'text-on-secondary-container');
        if(btn.innerText.toLowerCase() === location.toLowerCase() || (location === 'All' && btn.innerText === 'ALL NCR')) {
            btn.classList.add('bg-primary', 'text-white');
            btn.classList.remove('bg-secondary-container', 'text-on-secondary-container');
        }
    });

    let filtered = [];
    if (location === 'Saved') filtered = allSignals.filter(d => savedSignals.includes(d.id));
    else if (location === 'All') filtered = allSignals;
    else filtered = allSignals.filter(d => d.location.toLowerCase().includes(location.toLowerCase()));
    
    renderFeed(filtered);
}

// --- BULLETPROOF 3-TAB ROUTING LOGIC ---
function switchAppView(view) {
    window.trackEvent('tab_clicked', { tab_name: view });

    // 1. Toggle UI Sections
    document.getElementById('view-feed').classList.toggle('hidden', view !== 'feed');
    document.getElementById('view-circulars').classList.toggle('hidden', view !== 'circulars');
    document.getElementById('view-utils').classList.toggle('hidden', view !== 'utils');
    
    const showFilters = view === 'feed';
    
    const filterDesktop = document.getElementById('filter-container-desktop');
    if(filterDesktop) {
        filterDesktop.classList.toggle('hidden', !showFilters);
        if(filterDesktop.previousElementSibling) filterDesktop.previousElementSibling.classList.toggle('hidden', !showFilters);
    }
    
    document.getElementById('filter-container-mobile').classList.toggle('hidden', !showFilters);
    document.getElementById('refresh-btn').classList.toggle('hidden', !showFilters);

    // 2. Tab Highlighting (Bug Fixed)
    ['feed', 'circulars', 'utils'].forEach(t => {
        const deskBtn = document.getElementById(`tab-${t}-desktop`);
        if (deskBtn) {
            if(t === view) {
                deskBtn.className = "font-body uppercase tracking-widest text-xs text-primary font-bold border-b-2 border-primary py-1 transition-all";
            } else {
                deskBtn.className = "font-body uppercase tracking-widest text-xs text-outline-variant font-medium hover:text-primary border-b-2 border-transparent py-1 transition-all";
            }
        }
        
        const mobBtn = document.getElementById(`tab-${t}-mobile`);
        if (mobBtn) {
            if (t === view) {
                mobBtn.className = "flex flex-col items-center justify-center text-primary scale-110 transition-all w-full h-full";
                mobBtn.querySelector('span').classList.add('fill-current');
            } else {
                mobBtn.className = "flex flex-col items-center justify-center text-outline-variant hover:text-primary transition-all w-full h-full";
                mobBtn.querySelector('span').classList.remove('fill-current');
            }
        }
    });

    // 3. Initialize Data
    if (view === 'utils') {
        calculateArea(); 
        calculateStampDuty(); 
        calculateEMI();
        calculateYield();
    } else if (view === 'circulars') {
        fetchCirculars(); 
    }
}

// --- UTILITIES LOGIC ---

function calculateYield() {
    const costEl = document.getElementById('yield-cost');
    const rentEl = document.getElementById('yield-rent');
    if(!costEl || !rentEl) return;

    const cost = parseFloat(costEl.value) || 0;
    const rent = parseFloat(rentEl.value) || 0;
    
    let annualYield = 0;
    if (cost > 0) annualYield = ((rent * 12) / cost) * 100;
    
    document.getElementById('yield-total').innerText = annualYield.toFixed(2) + '%';
}

function calculateEMI() {
    const pEl = document.getElementById('emi-principal');
    const rEl = document.getElementById('emi-rate');
    const nEl = document.getElementById('emi-tenure');
    if(!pEl || !rEl || !nEl) return;

    const P = parseFloat(pEl.value) || 0;
    const R_annual = parseFloat(rEl.value) || 0;
    const N_years = parseFloat(nEl.value) || 0;

    const r = R_annual / 12 / 100;
    const n = N_years * 12;

    let emi = 0; let totalAmount = 0; let totalInterest = 0;

    if (r > 0 && n > 0 && P > 0) {
        emi = P * r * (Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
        totalAmount = emi * n;
        totalInterest = totalAmount - P;
    } else if (n > 0 && P > 0) {
        emi = P / n; 
        totalAmount = P;
    }

    document.getElementById('emi-total').innerText = '₹ ' + Math.round(emi).toLocaleString('en-IN');
    document.getElementById('emi-interest-display').innerText = '₹ ' + Math.round(totalInterest).toLocaleString('en-IN');
}

const unitRates = { sqft: 1, gaj: 9, sqm: 10.7639, acre: 43560, bigha: 27000 };
function calculateArea() {
    const valEl = document.getElementById('area-input');
    const unitEl = document.getElementById('area-unit');
    const resultsDiv = document.getElementById('area-results');
    if(!valEl || !unitEl || !resultsDiv) return;

    const val = parseFloat(valEl.value) || 0;
    const unit = unitEl.value;
    const baseSqFt = val * unitRates[unit];
    resultsDiv.innerHTML = ''; 

    Object.keys(unitRates).forEach(targetUnit => {
        if (targetUnit !== unit) {
            const converted = baseSqFt / unitRates[targetUnit];
            const labels = { sqft: 'Sq Feet', gaj: 'Sq Yards', sqm: 'Sq Meters', acre: 'Acres', bigha: 'Bigha (UP)' };
            resultsDiv.insertAdjacentHTML('beforeend', `
                <div class="p-6 border-r border-b border-outline-variant/10 hover:bg-surface-container-low transition-colors group">
                    <label class="font-body text-[10px] font-bold uppercase text-on-surface-variant group-hover:text-primary">${labels[targetUnit]}</label>
                    <p class="text-xl font-medium mt-2 text-primary-fixed-dim group-hover:text-primary">${converted.toLocaleString('en-IN', {maximumFractionDigits: 2})}</p>
                    <div class="h-0.5 w-0 group-hover:w-full bg-primary transition-all duration-300 mt-2"></div>
                </div>
            `);
        }
    });
}

function calculateStampDuty() {
    const valEl = document.getElementById('sd-value');
    const regEl = document.getElementById('sd-region');
    const buyEl = document.getElementById('sd-buyer');
    if(!valEl || !regEl || !buyEl) return;

    const val = parseFloat(valEl.value) || 0;
    const region = regEl.value;
    const buyer = buyEl.value;
    let sdRate = 0; let regRate = 1; 

    if(region === 'Delhi') sdRate = buyer === 'Male' ? 6 : (buyer === 'Female' ? 4 : 5);
    else if(region === 'Noida') sdRate = buyer === 'Male' ? 7 : (buyer === 'Female' ? 6 : 6.5); 
    else if(region === 'Gurgaon') sdRate = buyer === 'Male' ? 7 : (buyer === 'Female' ? 5 : 6); 

    const totalRate = sdRate + regRate;
    document.getElementById('sd-rates').innerText = `Duty ${sdRate}% + Reg ${regRate}%`;
    document.getElementById('sd-total').innerText = '₹ ' + (val * (totalRate / 100)).toLocaleString('en-IN', {maximumFractionDigits: 0});
}

// --- CIRCULAR DEPARTMENT SORTING LOGIC ---
async function fetchCirculars() {
    try {
        const response = await fetch('/api/circulars');
        const circulars = await response.json();
        
        const container = document.getElementById('circulars-bento-grid');
        if (!container) return;
        container.innerHTML = '';

        // Generate dynamic bento grid classes to make it look like an editorial layout
        const gridClasses = [
            "md:col-span-8", "md:col-span-4", "md:col-span-4", "md:col-span-4", "md:col-span-4", "md:col-span-6", "md:col-span-6"
        ];

        circulars.forEach((circ, index) => {
            const dateObj = new Date(circ.published_date);
            const dateStr = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
            
            // Cycle through the grid classes to create the asymmetric bento layout
            const spanClass = gridClasses[index % gridClasses.length];
            
            // Determine styling based on authority
            let tagColor = "bg-primary/5 text-primary";
            let icon = "gavel";
            if (circ.source_name.includes('UP RERA')) { tagColor = "bg-error/10 text-error"; icon = "policy"; }
            else if (circ.source_name.includes('Haryana')) { tagColor = "bg-tertiary/10 text-tertiary"; icon = "account_balance"; }

            const html = `
                <article class="${spanClass} group cursor-pointer" onclick="window.open('${circ.url}', '_blank'); window.trackEvent('circular_opened', { source: '${circ.source_name}' })">
                    <div class="bg-surface-container-lowest p-8 flex flex-col h-full transition-all duration-300 hover:bg-white shadow-ambient border border-outline-variant/10 relative overflow-hidden">
                        <div class="flex justify-between items-start mb-12 relative z-10">
                            <div>
                                <span class="${tagColor} text-[10px] font-bold px-2 py-1 tracking-widest uppercase rounded-sm">Notice</span>
                                <span class="ml-3 text-outline-variant font-body text-[10px] font-medium uppercase tracking-widest">${circ.source_name}</span>
                            </div>
                            <time class="text-outline-variant font-body text-[10px] font-medium uppercase tracking-widest">${dateStr}</time>
                        </div>
                        <div class="mt-auto relative z-10">
                            <h2 class="font-headline text-2xl md:text-3xl font-bold leading-tight mb-6 group-hover:underline decoration-1 underline-offset-4">${circ.title}</h2>
                            <div class="flex items-center gap-6 pt-6 border-t border-outline-variant/20">
                                <div class="flex items-center gap-2">
                                    <span class="material-symbols-outlined text-lg text-primary">description</span>
                                    <span class="text-[10px] font-bold uppercase tracking-widest text-primary">View Original PDF</span>
                                </div>
                            </div>
                        </div>
                        <div class="absolute -right-8 -top-8 opacity-[0.03] pointer-events-none group-hover:opacity-10 transition-opacity duration-500">
                            <span class="material-symbols-outlined text-[12rem]">${icon}</span>
                        </div>
                    </div>
                </article>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });
    } catch (error) {
        console.error("Failed to load circulars", error);
    }
}

// --- BOOT UP ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(err => console.log('PWA Failed:', err)));
}

// --- PWA SMART INSTALL PROMPT ---
let deferredPrompt;

function initPWA() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isAndroid = /android/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    // If they already installed it, do nothing
    if (isStandalone) return;

    // 1. ANDROID LOGIC (Native Prompt)
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        showInstallBanner('android');
    });

    // 2. IOS LOGIC (Manual Instructions)
    // We delay the iOS prompt by 3 seconds so it doesn't interrupt their first impression
    if (isIOS) {
        setTimeout(() => showInstallBanner('ios'), 3000);
    }
}

function showInstallBanner(os) {
    // Prevent duplicate banners
    if(document.getElementById('pwa-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-banner';
    banner.className = 'fixed bottom-20 left-4 right-4 md:bottom-8 md:right-8 md:left-auto md:w-96 bg-primary text-white p-4 rounded-md shadow-ambient z-[60] animate-fade-in-up flex gap-4 items-start';
    
    let content = '';
    if (os === 'android') {
        content = `
            <div class="flex-1">
                <h4 class="font-headline text-lg font-bold">Install AcreSignals</h4>
                <p class="text-[11px] text-outline-variant mt-1 leading-tight">Add to your home screen for zero-latency access and offline saves.</p>
            </div>
            <button onclick="triggerAndroidInstall()" class="bg-white text-primary px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest mt-1">Install</button>
            <button onclick="closePWABanner()" class="text-outline-variant ml-2 mt-1"><span class="material-symbols-outlined text-[16px]">close</span></button>
        `;
    } else if (os === 'ios') {
        content = `
            <div class="flex-1">
                <h4 class="font-headline text-lg font-bold">Install on iPhone</h4>
                <p class="text-[11px] text-outline-variant mt-1 leading-tight">Tap the <span class="material-symbols-outlined text-[14px] align-middle mx-0.5">ios_share</span> <b>Share</b> button below, then select <br><b>"Add to Home Screen"</b> <span class="material-symbols-outlined text-[14px] align-middle mx-0.5">add_box</span>.</p>
            </div>
            <button onclick="closePWABanner()" class="text-outline-variant ml-2 mt-1"><span class="material-symbols-outlined text-[16px]">close</span></button>
        `;
    }

    banner.innerHTML = content;
    document.body.appendChild(banner);
}

function triggerAndroidInstall() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                window.trackEvent('pwa_installed', { os: 'android' });
            }
            deferredPrompt = null;
            closePWABanner();
        });
    }
}

function closePWABanner() {
    const banner = document.getElementById('pwa-banner');
    if(banner) banner.remove();
}

// Add this to your existing DOMContentLoaded listener (Cleaned up so it only runs once)
document.addEventListener('DOMContentLoaded', () => {
    fetchSignals();
    fetchCirculars(); 
    initPWA(); 
});