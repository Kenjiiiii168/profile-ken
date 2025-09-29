// ===== GLOBAL VARIABLES =====
let particles = [];
let animationId;
let isScrolling = false;

// ===== DOM CONTENT LOADED =====
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    initLanguageAndThemeAndChat();
});

// ===== INITIALIZE APPLICATION =====
function initializeApp() {
    createParticles();
    setupScrollAnimations();
    setupSmoothScrolling();
    setupHeaderScroll();
    setupTypingAnimation();
    setupMobileMenu();
    setupParallaxEffects();
    setupIntersectionObserver();
    
    // Start particle animation
    animateParticles();
    
    console.log('🚀 Ken\'s Portfolio loaded successfully!');
}

// ===== LANG, THEME, CHAT =====
function initLanguageAndThemeAndChat() {
    const langSelect = document.getElementById('lang');
    const themeToggle = document.getElementById('themeToggle');
    const chatToggle = document.getElementById('chatToggle');
    const chatWindow = document.getElementById('chatWindow');
    const chatClose = document.getElementById('chatClose');
    const chatLog = document.getElementById('chatLog');
    const chatForm = document.getElementById('chatForm');
    const chatText = document.getElementById('chatText');
    const chatSend = document.getElementById('chatSend');
    const chatTitle = document.getElementById('chat_title');

    // Load translations JSON injected as script tag
    let TRANSLATIONS = {};
    try {
        const dataEl = document.getElementById('translations-data');
        if (dataEl && dataEl.textContent) {
            TRANSLATIONS = JSON.parse(dataEl.textContent);
        }
    } catch (e) {
        console.warn('Translations missing or invalid:', e);
    }

    // LANGUAGE
    const urlParams = new URLSearchParams(window.location.search);
    const langFromUrl = urlParams.get('lang');
    const savedLang = langFromUrl || localStorage.getItem('lang') || 'th';
    if (langSelect) {
        langSelect.value = savedLang;
        langSelect.addEventListener('change', () => {
            const newLang = langSelect.value;
            localStorage.setItem('lang', newLang);
            const currentPath = window.location.pathname + window.location.hash;
            const basePath = window.location.pathname;
            window.history.replaceState({}, '', `${basePath}?lang=${newLang}${window.location.hash || ''}`);
            applyTranslations(newLang, TRANSLATIONS);
            updateChatUI(newLang);
        });
    }
    applyTranslations(savedLang, TRANSLATIONS);

    // THEME
    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme, themeToggle);
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const current = document.body.classList.contains('light-theme') ? 'light' : 'dark';
            const next = current === 'dark' ? 'light' : 'dark';
            applyTheme(next, themeToggle);
        });
    }

    // CHAT
    if (chatToggle && chatWindow) {
        const toggleChat = () => {
            chatWindow.hidden = !chatWindow.hidden;
            chatWindow.classList.toggle('visible');
            if (!chatWindow.hidden && !localStorage.getItem('chat_seen')) {
                const lang = localStorage.getItem('lang') || 'th';
                addBubble(chatLog, chatSTR[lang]?.hello || chatSTR.th.hello, 'bot');
                localStorage.setItem('chat_seen', 'true');
            }
        };
        chatToggle.addEventListener('click', toggleChat);
        if (chatClose) chatClose.addEventListener('click', toggleChat);
    }

    if (chatForm && chatText && chatSend && chatLog) {
        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = chatText.value.trim();
            if (!text) return;
            addBubble(chatLog, text, 'me');
            chatText.value = '';
            chatSend.disabled = true;
            addBubble(chatLog, '...', 'bot');
            try {
                const lang = localStorage.getItem('lang') || 'th';
                // 1) Try deterministic knowledge answer first (fast & precise)
                const T = getTranslations();
                const local = answerFromKnowledge(text, lang, T);
                let reply = local;

                // 2) Prefer backend Gemini if configured
                const apiBase = typeof window.CHAT_API_BASE === 'string' && window.CHAT_API_BASE.trim().length > 0
                  ? window.CHAT_API_BASE.trim()
                  : null;
                if (!reply && apiBase) {
                    try {
                        const resp = await fetch(`${apiBase}/chat`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ message: text, lang })
                        });
                        if (resp.ok) {
                            const data = await resp.json();
                            reply = data.reply || reply;
                        }
                    } catch (e) {
                        // ignore and fallback to client-side Gemini
                    }
                }

                // 3) Fallback to client-side Gemini
                if (!reply) {
                    reply = await generateWithGemini(text, lang, T);
                }

                const last = chatLog.querySelector('.bubble:last-child');
                if (last) last.textContent = reply || '...';
            } catch (err) {
                const last = chatLog.querySelector('.bubble:last-child');
                if (last) last.textContent = 'ขออภัย เกิดข้อผิดพลาดในการเชื่อมต่อแชท';
                console.error(err);
            } finally {
                chatSend.disabled = false;
            }
        });
    }

    // Init chat title/text placeholders
    updateChatUI(savedLang, chatTitle, chatText);
}

function applyTheme(theme, toggleBtn) {
    if (theme === 'light') {
        document.body.classList.add('light-theme');
        if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        document.body.classList.remove('light-theme');
        if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
    }
    localStorage.setItem('theme', theme);
}

function applyTranslations(lang, TRANSLATIONS) {
    if (!TRANSLATIONS || !TRANSLATIONS[lang]) return;
    const t = TRANSLATIONS[lang];

    // Document language, title, meta description
    document.documentElement.lang = lang;
    const titleBase = 'Ken - Website Developer | Frontend & Jamstack';
    const titleMap = {
        th: titleBase,
        en: titleBase,
        ja: titleBase
    };
    document.title = titleMap[lang] || titleBase;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
        metaDesc.setAttribute('content',
            lang === 'th'
                ? 'นักพัฒนาเว็บไซต์อิสระ เชี่ยวชาญ Frontend & Jamstack อายุ 22 ปี'
                : lang === 'ja'
                    ? 'フリーランスのウェブサイト開発者。フロントエンド & Jamstack に特化。22歳'
                    : 'Freelance website developer specialized in Frontend & Jamstack, age 22'
        );
    }

    // Nav
    const navLinks = document.querySelectorAll('.nav-links .nav-link');
    if (navLinks[0]) navLinks[0].textContent = lang === 'th' ? 'เกี่ยวกับผม' : (lang === 'ja' ? '自己紹介' : 'About');
    if (navLinks[1]) navLinks[1].textContent = lang === 'th' ? 'ทักษะ' : (lang === 'ja' ? 'スキル' : 'Skills');
    if (navLinks[2]) navLinks[2].textContent = lang === 'th' ? 'ผลงาน' : (lang === 'ja' ? '制作実績' : 'Portfolio');
    if (navLinks[3]) navLinks[3].textContent = lang === 'th' ? 'ติดต่อ' : (lang === 'ja' ? 'お問い合わせ' : 'Contact');

    // Hero greeting and description
    const typing = document.getElementById('typing-text');
    if (typing) {
        typing.textContent = lang === 'th'
            ? `สวัสดีครับ ผม${t.name} (Ken)`
            : lang === 'ja'
                ? `こんにちは、${t.name}（Ken）です`
                : `Hi, I'm ${t.name} (Ken)`;
    }
    const heroDesc = document.querySelector('.hero-description');
    if (heroDesc) {
        heroDesc.textContent = lang === 'th'
            ? 'นักพัฒนาเว็บไซต์อิสระอายุ 22 ปี ที่มีความเชี่ยวชาญในการออกแบบและพัฒนาเว็บไซต์สำหรับธุรกิจขนาดเล็กถึงขนาดกลาง โดยใช้เทคโนโลยีที่ทันสมัยเพื่อสร้างเว็บไซต์ที่โหลดเร็วและปรับแต่งได้ง่าย'
            : lang === 'ja'
                ? '22歳のフリーランス開発者。最新技術で高速かつカスタマイズしやすいサイトを中小企業向けに制作します。'
                : 'A 22-year-old freelance developer building fast, customizable websites for SMBs using modern tech.';
    }
    const heroBtn1 = document.querySelector('.button-group .btn.btn-primary span');
    if (heroBtn1) heroBtn1.textContent = t.cta_portfolio_btn || (lang === 'ja' ? '実績を見る' : 'View Work');
    const heroBtn2 = document.querySelector('.button-group .btn.btn-secondary span');
    if (heroBtn2) heroBtn2.textContent = lang === 'th' ? 'ติดต่อ' : (lang === 'ja' ? '連絡する' : 'Contact');

    // Sections headings
    const aboutTitle = document.querySelector('#about .section-title');
    const aboutSub = document.querySelector('#about .section-subtitle');
    if (aboutTitle) aboutTitle.textContent = lang === 'th' ? '✨ เกี่ยวกับผม' : (lang === 'ja' ? '✨ 自己紹介' : '✨ About Me');
    if (aboutSub) aboutSub.textContent = lang === 'th' ? 'ข้อมูลส่วนตัวและความสนใจของผม' : (lang === 'ja' ? '自己紹介と関心ごと' : 'Personal info and interests');

    const skillsTitle = document.querySelector('#skills .section-title');
    const skillsSub = document.querySelector('#skills .section-subtitle');
    if (skillsTitle) skillsTitle.textContent = lang === 'th' ? '🛠️ ทักษะและเครื่องมือ' : (lang === 'ja' ? '🛠️ スキル・ツール' : '🛠️ Skills & Tools');
    if (skillsSub) skillsSub.textContent = lang === 'th' ? 'เทคโนโลยีและเครื่องมือที่ผมเชี่ยวชาญ' : (lang === 'ja' ? '得意な技術とツール' : 'Technologies I use');

    const portfolioTitle = document.querySelector('#portfolio .section-title');
    const portfolioSub = document.querySelector('#portfolio .section-subtitle');
    if (portfolioTitle) portfolioTitle.textContent = t.portfolio_title ? `🚀 ${t.portfolio_title}` : (lang === 'ja' ? '🚀 制作実績の例' : '🚀 Sample Projects');
    if (portfolioSub) portfolioSub.textContent = lang === 'th' ? 'นี่คือตัวอย่างผลงานบางส่วนของผมครับ' : (lang === 'ja' ? '私の制作実績の一部です' : 'Here are some examples of my work');

    const contactTitle = document.querySelector('#contact .section-title');
    const contactSub = document.querySelector('#contact .section-subtitle');
    if (contactTitle) contactTitle.textContent = t.contact_title ? `📬 ${t.contact_title}` : (lang === 'ja' ? '📬 お問い合わせ' : '📬 Contact');
    if (contactSub) contactSub.textContent = t.contact_desc || (lang === 'ja' ? 'お仕事やご質問はお気軽にご連絡ください' : 'Reach out for projects or inquiries');

    // About cards (static mapping with data.json values where possible)
    const aboutCards = document.querySelectorAll('#about .about-card');
    if (aboutCards[0]) {
        const h = aboutCards[0].querySelector('h4');
        const p = aboutCards[0].querySelector('p');
        if (h) h.textContent = lang === 'th' ? 'อายุ' : (lang === 'ja' ? '年齢' : 'Age');
        if (p) p.textContent = lang === 'th' ? `${t.age} ปี` : (lang === 'ja' ? `${t.age} 歳` : `${t.age} yrs`);
    }
    if (aboutCards[1]) {
        const h = aboutCards[1].querySelector('h4');
        const p = aboutCards[1].querySelector('p');
        if (h) h.textContent = lang === 'th' ? 'สถานะ' : (lang === 'ja' ? 'ステータス' : 'Status');
        if (p) p.textContent = t.meta_status || (lang === 'ja' ? 'フリーランスとして活動中' : 'Available for freelance');
    }
    if (aboutCards[2]) {
        const h = aboutCards[2].querySelector('h4');
        const p = aboutCards[2].querySelector('p');
        if (h) h.textContent = lang === 'th' ? 'ภาษา' : (lang === 'ja' ? '言語' : 'Languages');
        if (p) p.textContent = t.meta_lang || (lang === 'ja' ? 'タイ語 / 英語' : 'Thai / English');
    }
    if (aboutCards[3]) {
        const h = aboutCards[3].querySelector('h4');
        const p = aboutCards[3].querySelector('p');
        if (h) h.textContent = lang === 'th' ? 'สิ่งที่ชอบ' : (lang === 'ja' ? '好きなこと' : 'Interests');
        if (p) p.textContent = t.meta_focus || (lang === 'ja' ? 'UI, パフォーマンス, アニメーション' : 'UI, Performance, Animation');
    }

    // Portfolio cards from data.json where applicable
    const portfolioCards = document.querySelectorAll('.portfolio-card');
    const projects = Array.isArray(t.projects) ? t.projects : [];
    portfolioCards.forEach((card, idx) => {
        const titleEl = card.querySelector('h4');
        const descEl = card.querySelector('p');
        const proj = projects[idx];
        if (proj) {
            if (titleEl) titleEl.textContent = proj.name;
            if (descEl) descEl.textContent = proj.description;
        }
    });

    // Footer
    const footerP = document.querySelector('.footer-content p');
    if (footerP) {
        footerP.childNodes.forEach((n) => {
            if (n.nodeType === Node.TEXT_NODE) n.textContent = lang === 'ja' ? 'Ken により制作' : (lang === 'en' ? 'Made with ' : 'Made with ');
        });
    }

    // Chat UI
    updateChatUI(lang);
    const chatSend = document.getElementById('chatSend');
    if (chatSend) chatSend.textContent = lang === 'th' ? 'ส่ง' : (lang === 'ja' ? '送信' : 'Send');
}

const chatSTR = {
    th: { title: 'ผู้ช่วยแชท', ph: 'พิมพ์ข้อความ...', hello: 'สวัสดีครับ! ถามเกี่ยวกับเค็นได้เลย' },
    en: { title: 'Chat Assistant', ph: 'Type a message...', hello: 'Hi there! Ask me anything about Ken.' },
    ja: { title: 'チャットアシスタント', ph: 'メッセージを入力...', hello: 'こんにちは！ケンについて何でも聞いてください。' }
};

function updateChatUI(lang, chatTitleEl, chatTextEl) {
    const s = chatSTR[lang] || chatSTR.en;
    const title = chatTitleEl || document.getElementById('chat_title');
    const input = chatTextEl || document.getElementById('chatText');
    if (title) title.textContent = s.title;
    if (input) input.placeholder = s.ph;
}

function addBubble(chatLogEl, text, who) {
    if (!chatLogEl) return;
    const div = document.createElement('div');
    div.className = `bubble ${who}`;
    div.textContent = text;
    chatLogEl.appendChild(div);
    chatLogEl.scrollTop = chatLogEl.scrollHeight;
}

// ===== GEMINI CLIENT-SIDE CALL =====
async function generateWithGemini(userQuestion, lang, allTranslations) {
    const apiKey = window.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Missing GEMINI_API_KEY');

    const knowledge = (allTranslations && (allTranslations[lang] || allTranslations.th)) || {};

    const rules = [
        'ตอบจากข้อมูลที่ให้ไว้เท่านั้น ห้ามเดาข้อมูลใหม่',
        'ห้ามอ้างอิงสิ่งที่ไม่มีใน knowledge base',
        'ถ้าคำถามไม่เกี่ยวข้องหรือไม่มีข้อมูล ให้บอกอย่างสุภาพว่าไม่มีข้อมูล',
        'ภาษาที่ใช้ตอบ: ' + lang
    ].join('\n- ');

    const prompt = `บทบาท: ผู้ช่วยตอบคำถามในเว็บพอร์ตโฟลิโอ\nกติกา:\n- ${rules}\n\nKNOWLEDGE BASE:\n${JSON.stringify(knowledge)}\n\nคำถามผู้ใช้: ${userQuestion}\nคำตอบ:`;

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=' + encodeURIComponent(apiKey);
    const body = {
        contents: [
            {
                role: 'user',
                parts: [{ text: prompt }]
            }
        ]
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('Gemini request failed');
    const data = await res.json();
    // Extract text
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text.trim();
}

// ===== TRANSLATIONS ACCESS & RULE-BASED ANSWERS =====
function getTranslations() {
    try {
        const dataEl = document.getElementById('translations-data');
        if (dataEl && dataEl.textContent) {
            return JSON.parse(dataEl.textContent);
        }
    } catch {}
    return null;
}

function answerFromKnowledge(question, lang, T) {
    if (!T) return null;
    const th = (T[lang] || T.th) || {};
    const q = question.toLowerCase().trim();

    // Normalize common name variants
    const hasKen = q.includes('ken') || q.includes('เคน') || q.includes('เค็น');
    const askWho = q.includes('คือใคร') || q.includes('who is') || q.includes('who are you') || q === 'who' || q === 'who are you' || q === 'who is ken';

    // Name / Who
    if (askWho || (hasKen && (q.includes('who') || q.includes('คือ') || q.includes('คือใคร')))) {
        const name = th.name || 'เค็น';
        const role = th.role_short || '';
        const roleLong = th.role_long || '';
        const desc = roleLong || role;
        return desc ? `${name} — ${desc}` : `${name}`;
    }

    // Age
    if (q.includes('อายุ') || q.includes('age')) {
        if (typeof th.age !== 'undefined') return `อายุ ${th.age} ปี`;
    }

    // Skills
    if (q.includes('ทักษะ') || q.includes('skills') || q.includes('สกิล')) {
        if (Array.isArray(th.skills)) return `ทักษะ: ${th.skills.join(', ')}`;
    }

    // Projects / Portfolio
    if (q.includes('ผลงาน') || q.includes('projects') || q.includes('portfolio')) {
        if (Array.isArray(th.projects)) {
            const lines = th.projects.map(p => `- ${p.name}: ${p.description}`);
            return `ตัวอย่างผลงาน\n${lines.join('\n')}`;
        }
    }

    // Language capabilities
    if (q.includes('ภาษา') || q.includes('languages')) {
        if (th.meta_lang) return th.meta_lang;
    }

    // Status
    if (q.includes('สถานะ') || q.includes('available') || q.includes('ว่าง') || q.includes('พร้อมรับงาน')) {
        if (th.meta_status) return th.meta_status;
    }

    // Bio
    if (q.includes('แนะนำตัว') || q.includes('about') || q.includes('bio')) {
        if (th.bio) return th.bio.replace(/<[^>]+>/g, '');
    }

    return null; // let Gemini handle
}

// ===== PARTICLE SYSTEM =====
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    const particleCount = 50;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 20 + 's';
        particle.style.animationDuration = (Math.random() * 10 + 15) + 's';
        
        // Random colors
        const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe'];
        particle.style.background = colors[Math.floor(Math.random() * colors.length)];
        
        particlesContainer.appendChild(particle);
    }
}

function animateParticles() {
    const particleElements = document.querySelectorAll('.particle');
    
    particleElements.forEach((particle, index) => {
        const delay = index * 0.1;
        setTimeout(() => {
            particle.style.animationPlayState = 'running';
        }, delay * 1000);
    });
}

// ===== TYPING ANIMATION =====
function setupTypingAnimation() {
    const typingElement = document.getElementById('typing-text');
    if (!typingElement) return;
    
    const text = typingElement.textContent;
    typingElement.textContent = '';
    
    let i = 0;
    const typeSpeed = 100;
    
    function typeWriter() {
        if (i < text.length) {
            typingElement.textContent += text.charAt(i);
            i++;
            setTimeout(typeWriter, typeSpeed);
        } else {
            // Remove cursor after typing is complete
            setTimeout(() => {
                typingElement.style.setProperty('--cursor', 'none');
            }, 1000);
        }
    }
    
    // Start typing animation after a delay
    setTimeout(typeWriter, 1000);
}

// ===== SMOOTH SCROLLING =====
function setupSmoothScrolling() {
    const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const animatedScrollTo = (to) => {
        const start = window.pageYOffset;
        const distance = to - start;
        const duration = 600;
        let startTime = null;

        function step(timestamp) {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = easeInOutCubic(progress);
            window.scrollTo(0, start + distance * eased);
            if (elapsed < duration) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    };

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (!href || href === '#') return;
            const target = document.querySelector(href);
            if (!target) return;
            e.preventDefault();
            const headerEl = document.querySelector('.header-glass');
            const headerHeight = headerEl ? headerEl.offsetHeight : 0;
            const targetTop = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;
            animatedScrollTo(targetTop);
        });
    });
}

// ===== HEADER SCROLL EFFECT =====
function setupHeaderScroll() {
    const header = document.querySelector('.header-glass');
    let lastScrollY = window.scrollY;
    
    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;
        
        if (currentScrollY > 100) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        
        // Hide/show header on scroll
        if (currentScrollY > lastScrollY && currentScrollY > 200) {
            header.style.transform = 'translateY(-100%)';
        } else {
            header.style.transform = 'translateY(0)';
        }
        
        lastScrollY = currentScrollY;
    });
}

// ===== SCROLL ANIMATIONS =====
function setupScrollAnimations() {
    const revealElements = document.querySelectorAll('.reveal');
    
    const revealOnScroll = () => {
        revealElements.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;
            const elementVisible = 150;
            
            if (elementTop < window.innerHeight - elementVisible) {
                element.classList.add('visible');
            }
        });
    };
    
    window.addEventListener('scroll', revealOnScroll);
    revealOnScroll(); // Check on load
}

// ===== INTERSECTION OBSERVER =====
function setupIntersectionObserver() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                
                // Add stagger effect for child elements
                const children = entry.target.querySelectorAll('.reveal');
                children.forEach((child, index) => {
                    setTimeout(() => {
                        child.classList.add('visible');
                    }, index * 100);
                });
            }
        });
    }, observerOptions);
    
    // Observe all sections
    document.querySelectorAll('section').forEach(section => {
        observer.observe(section);
    });
}

// ===== PARALLAX EFFECTS =====
function setupParallaxEffects() {
    const parallaxElements = document.querySelectorAll('.shape');
    
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const rate = scrolled * -0.5;
        
        parallaxElements.forEach((element, index) => {
            const speed = 0.5 + (index * 0.2);
            element.style.transform = `translateY(${rate * speed}px)`;
        });
    });
}

// ===== MOBILE MENU =====
function setupMobileMenu() {
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    
    if (mobileToggle && navLinks) {
        mobileToggle.addEventListener('click', () => {
            mobileToggle.classList.toggle('active');
            navLinks.classList.toggle('active');
        });
        
        // Close menu when clicking on a link
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mobileToggle.classList.remove('active');
                navLinks.classList.remove('active');
            });
        });
    }
}

// ===== CURSOR EFFECTS =====
// (removed) setupCursorEffects - not used

// ===== LOADING ANIMATION =====
// (removed) showLoadingAnimation - not used

// ===== PERFORMANCE OPTIMIZATION =====
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ===== SCROLL PERFORMANCE =====
const optimizedScrollHandler = debounce(() => {
    // Scroll-based animations here
    updateScrollProgress();
}, 16); // ~60fps

window.addEventListener('scroll', optimizedScrollHandler);

function updateScrollProgress() {
    const scrollTop = window.pageYOffset;
    const docHeight = document.body.offsetHeight - window.innerHeight;
    const scrollPercent = (scrollTop / docHeight) * 100;
    
    // Update progress bar if exists
    const progressBar = document.querySelector('.scroll-progress');
    if (progressBar) {
        progressBar.style.width = scrollPercent + '%';
    }
}

// ===== INTERACTIVE ELEMENTS =====
function setupInteractiveElements() {
    // Skill items hover effect
    document.querySelectorAll('.skill-item').forEach(item => {
        item.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.05)';
        });
        
        item.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
    
    // Portfolio cards 3D effect
    document.querySelectorAll('.portfolio-card').forEach(card => {
        card.addEventListener('mousemove', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = (y - centerY) / 10;
            const rotateY = (centerX - x) / 10;
            
            this.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateZ(0)';
        });
    });
}

// ===== THEME TOGGLE (BONUS) =====
function setupThemeToggle() {
    const themeToggle = document.createElement('button');
    themeToggle.className = 'theme-toggle';
    themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    themeToggle.title = 'Toggle theme';
    
    document.querySelector('nav').appendChild(themeToggle);
    
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        themeToggle.innerHTML = isLight ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        
        // Save preference
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });
    
    // Load saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
}

// ===== CONTACT FORM (BONUS) =====
// (removed) setupContactForm - not used

// ===== NOTIFICATIONS =====
// (removed) showNotification - not used

// ===== LAZY LOADING =====
// (removed) setupLazyLoading - not used

// ===== ERROR HANDLING =====
window.addEventListener('error', (e) => {
    console.error('JavaScript Error:', e.error);
    // You could send this to an error tracking service
});

// ===== RESIZE HANDLER =====
window.addEventListener('resize', debounce(() => {
    // Handle resize events
    updateLayout();
}, 250));

function updateLayout() {
    // Update layout based on screen size
    const isMobile = window.innerWidth < 768;
    document.body.classList.toggle('mobile', isMobile);
}

// ===== INITIALIZE ADDITIONAL FEATURES =====
document.addEventListener('DOMContentLoaded', () => {
    // Uncomment to enable additional features
    // setupCursorEffects();
    // setupThemeToggle();
    // setupContactForm();
    // setupLazyLoading();
    setupInteractiveElements();
    updateLayout();
});

// ===== EXPORT FOR TESTING =====
// (removed) CommonJS exports - not used in browser