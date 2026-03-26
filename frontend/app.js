let allSignals = [];

function timeSince(dateString) {
    const date = new Date(dateString);
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 3600;
    if (interval > 24) return Math.floor(interval / 24) + "d ago";
    if (interval >= 1) return Math.floor(interval) + "h ago";
    return Math.floor(seconds / 60) + "m ago";
}

function shareToWhatsApp(id) {
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

    const text = `${impactEmoji} *${signal.impact} Signal: ${signal.location}*\n${catEmoji} Category: ${signal.category}\n\n"${signal.summary}"\n\n🔗 Source: ${signal.sourceUrl}\n📊 *Powered by MarketSignals*`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
}

async function fetchSignals() {
    const container = document.getElementById('signals-list');
    container.innerHTML = '<div class="text-center py-10 text-primary-fixed-dim font-bold text-[10px] uppercase tracking-widest animate-pulse">Establishing Connection...</div>';
    
    try {
        const response = await fetch('/api/signals');
        const dbSignals = await response.json();
        
        allSignals = dbSignals.map(signal => ({
            id: signal.id,
            date: timeSince(signal.published_at),
            location: signal.location,
            category: signal.category,
            impact: signal.impact,
            summary: signal.summary,
            sourceUrl: signal.source_url
        }));
        
        document.getElementById('sync-status').innerHTML = '<span class="material-symbols-outlined text-[16px] text-primary">check</span>';
        renderFeed(allSignals);
    } catch (error) {
        container.innerHTML = `<div class="text-center py-10 text-bearish font-bold text-[10px] uppercase tracking-widest">Connection Terminated. Check Server.</div>`;
    }
}

function renderFeed(data) {
    const container = document.getElementById('signals-list');
    container.innerHTML = ''; 

    if (data.length === 0) {
        container.innerHTML = `<div class="text-center py-10 text-primary-fixed-dim font-bold text-[10px] uppercase tracking-widest">No Signals Extracted.</div>`;
        return;
    }

    data.forEach(signal => {
        let chipBg = signal.impact === 'Positive' ? 'bg-bullish-container' : (signal.impact === 'Negative' ? 'bg-bearish-container' : 'bg-neutral-container');
        let chipText = signal.impact === 'Positive' ? 'text-bullish' : (signal.impact === 'Negative' ? 'text-bearish' : 'text-neutral');
        
        let sentences = signal.summary.split('. ').filter(s => s.trim().length > 0);
        let bullet1 = sentences[0] ? sentences[0] + (sentences[0].endsWith('.') ? '' : '.') : '';
        let bullet2 = sentences[1] ? sentences[1] + (sentences[1].endsWith('.') ? '' : '.') : '';

        const cardHTML = `
            <div class="bg-surface-container-lowest rounded-md p-4 flex flex-col gap-2.5">
                <div class="flex items-center justify-between border-b border-outline-variant/20 pb-2">
                    <span class="text-[10px] font-bold tracking-widest text-primary-fixed-dim uppercase">${signal.category}</span>
                    <span class="text-[10px] font-medium text-outline-variant">${signal.date}</span>
                </div>
                <div class="flex items-start justify-between gap-2 pt-1">
                    <h2 class="font-headline text-3xl font-medium leading-none text-primary tracking-tight">${signal.location}</h2>
                    <span class="px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest ${chipBg} ${chipText} flex-shrink-0">${signal.impact}</span>
                </div>
                <div class="bg-surface rounded-sm p-3 mt-2 space-y-1.5 border border-outline-variant/10">
                    ${bullet1 ? `<div class="flex gap-2 items-start"><span class="text-outline-variant mt-1 text-[10px]">■</span><p class="text-[13px] font-medium text-on-surface leading-snug">${bullet1}</p></div>` : ''}
                    ${bullet2 ? `<div class="flex gap-2 items-start"><span class="text-outline-variant mt-1 text-[10px]">■</span><p class="text-[13px] font-medium text-on-surface leading-snug">${bullet2}</p></div>` : ''}
                </div>
                <div class="pt-3 mt-1 flex justify-between items-center border-t border-outline-variant/10">
                    <a href="${signal.sourceUrl}" target="_blank" class="inline-flex items-center gap-1 text-[10px] font-bold text-outline-variant hover:text-primary uppercase tracking-widest transition-colors">
                        Source Report <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </a>
                    <button onclick="shareToWhatsApp(${signal.id})" class="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary-fixed-dim hover:text-[#25D366] uppercase tracking-widest transition-colors">
                        <span class="material-symbols-outlined text-[14px]">share</span> WhatsApp
                    </button>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHTML);
    });

    container.insertAdjacentHTML('beforeend', `<div class="py-12 text-center flex flex-col items-center gap-1"><span class="material-symbols-outlined text-outline-variant text-xl">remove</span><p class="text-[9px] text-outline-variant font-bold uppercase tracking-widest">End of Feed</p></div>`);
}

function filterFeed(location) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('bg-primary', 'text-white');
        btn.classList.add('bg-secondary-container', 'text-on-secondary-container');
        if(btn.innerText.toLowerCase() === location.toLowerCase() || (location === 'All' && btn.innerText === 'ALL NCR')) {
            btn.classList.add('bg-primary', 'text-white');
            btn.classList.remove('bg-secondary-container', 'text-on-secondary-container');
        }
    });
    let filtered = location === 'All' ? allSignals : allSignals.filter(d => d.location.toLowerCase().includes(location.toLowerCase()));
    renderFeed(filtered);
}

// --- 3-TAB ROUTING LOGIC ---
function switchAppView(view) {
    // 1. Hide/Show Content
    document.getElementById('view-feed').classList.toggle('hidden', view !== 'feed');
    document.getElementById('view-circulars').classList.toggle('hidden', view !== 'circulars');
    document.getElementById('view-utils').classList.toggle('hidden', view !== 'utils');
    
    // Hide Feed filters/refresh if not on feed
    document.getElementById('filter-container').classList.toggle('hidden', view !== 'feed');
    document.getElementById('refresh-btn').classList.toggle('hidden', view !== 'feed');

    // 2. Update Tab Buttons visually
    const tabs = ['feed', 'circulars', 'utils'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if (t === view) {
            btn.className = "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-primary text-white rounded transition-colors";
        } else {
            btn.className = "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary-fixed-dim hover:bg-outline-variant/20 rounded transition-colors";
        }
    });

    // 3. Trigger initializations
    if (view === 'utils') {
        calculateArea(); 
        calculateStampDuty(); 
    } else if (view === 'circulars') {
        fetchCirculars(); // Fetch circulars when tab is opened
    }
}

// --- UTILITIES LOGIC ---
const unitRates = { sqft: 1, gaj: 9, sqm: 10.7639, acre: 43560, bigha: 27000 };
function calculateArea() {
    const val = parseFloat(document.getElementById('area-input').value) || 0;
    const unit = document.getElementById('area-unit').value;
    const baseSqFt = val * unitRates[unit];
    const resultsDiv = document.getElementById('area-results');
    resultsDiv.innerHTML = ''; 

    Object.keys(unitRates).forEach(targetUnit => {
        if (targetUnit !== unit) {
            const converted = baseSqFt / unitRates[targetUnit];
            const labels = { sqft: 'Sq Ft', gaj: 'Sq Yd (Gaj)', sqm: 'Sq Meter', acre: 'Acres', bigha: 'Bigha (UP)' };
            resultsDiv.insertAdjacentHTML('beforeend', `
                <div class="bg-surface p-3 rounded-sm border border-outline-variant/10 flex flex-col">
                    <span class="text-[10px] font-bold text-primary-fixed-dim uppercase tracking-widest">${labels[targetUnit]}</span>
                    <span class="font-headline text-lg font-bold text-primary">${converted.toLocaleString('en-IN', {maximumFractionDigits: 2})}</span>
                </div>
            `);
        }
    });
}

function calculateStampDuty() {
    const val = parseFloat(document.getElementById('sd-value').value) || 0;
    const region = document.getElementById('sd-region').value;
    const buyer = document.getElementById('sd-buyer').value;
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
        
        // Define our department buckets
        const containers = {
            'DDA': document.getElementById('circ-dda'),
            'UP RERA': document.getElementById('circ-uprera'),
            'Noida Authority': document.getElementById('circ-noida'),
            'Haryana RERA': document.getElementById('circ-hrera')
        };

        // Clear existing content
        Object.values(containers).forEach(c => c.innerHTML = '');

        circulars.forEach(circ => {
            const dateObj = new Date(circ.published_date);
            const dateStr = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

            const html = `
                <a href="${circ.url}" target="_blank" class="block bg-surface-container-lowest p-3 rounded-md border border-outline-variant/10 hover:border-primary/40 transition-colors shadow-sm">
                    <div class="flex justify-between items-center mb-1.5">
                        <span class="text-[9px] font-bold tracking-widest text-primary-fixed-dim uppercase flex items-center gap-1">
                            <span class="material-symbols-outlined text-[12px]">picture_as_pdf</span>
                            OFFICIAL PDF
                        </span>
                        <span class="text-[9px] font-medium text-outline-variant">${dateStr}</span>
                    </div>
                    <p class="text-[13px] font-medium text-on-surface leading-snug">${circ.title}</p>
                </a>
            `;

            // Sort them into the right buckets based on source_name
            if (circ.source_name.includes('DDA')) containers['DDA'].insertAdjacentHTML('beforeend', html);
            else if (circ.source_name.includes('UP RERA')) containers['UP RERA'].insertAdjacentHTML('beforeend', html);
            else if (circ.source_name.includes('Noida')) containers['Noida Authority'].insertAdjacentHTML('beforeend', html);
            else if (circ.source_name.includes('Haryana')) containers['Haryana RERA'].insertAdjacentHTML('beforeend', html);
        });

        // Add a clean placeholder for any department that doesn't have notices yet
        Object.values(containers).forEach(c => {
            if (c.innerHTML === '') {
                c.innerHTML = '<p class="text-[11px] text-outline-variant">No recent notices available.</p>';
            }
        });

    } catch (error) {
        console.error("Failed to load circulars", error);
    }
}

// --- BOOT UP ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(err => console.log('PWA Failed:', err)));
}

document.addEventListener('DOMContentLoaded', () => {
    fetchSignals();
});