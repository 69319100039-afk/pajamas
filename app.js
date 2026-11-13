// นำเข้า Firebase Authentication
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyCLZkKQOiQ22ZoyDKrBoyNacNGus99F4RY",
    authDomain: "sleep-f77fe.firebaseapp.com",
    projectId: "sleep-f77fe",
    storageBucket: "sleep-f77fe.firebasestorage.app",
    messagingSenderId: "403242518970",
    appId: "1:403242518970:web:ae86bba2f17fcdfac23583",
    measurementId: "G-NLSD8PWPGF"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// --- ฟังก์ชันสร้าง Payload มาตรฐาน PromptPay (EMVCo + CRC16) ---
function generatePromptPayPayload(phoneNumber, amount) {
    let target = phoneNumber.replace(/[^0-9]/g, '');
    if (target.startsWith('0')) {
        target = '0066' + target.substring(1);
    }

    const formatTag = (id, value) => {
        const len = String(value.length).padStart(2, '0');
        return id + len + value;
    };

    const merchantInfo = formatTag('00', 'A000000677010111') + formatTag('01', target);

    let payload = [
        formatTag('00', '01'),
        formatTag('01', amount > 0 ? '12' : '11'),
        formatTag('29', merchantInfo),
        formatTag('53', '764'),
        amount > 0 ? formatTag('54', Number(amount).toFixed(2)) : '',
        formatTag('58', 'TH'),
        '6304'
    ].join('');

    let crc = 0xFFFF;
    for (let i = 0; i < payload.length; i++) {
        crc ^= payload.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
            crc &= 0xFFFF;
        }
    }
    return payload + crc.toString(16).toUpperCase().padStart(4, '0');
}

const path = window.location.pathname;

// --- หน้า index.html ---
if (path.includes("index.html") || path.endsWith("/") || path === "") {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');

    if (registerBtn) {
        registerBtn.addEventListener('click', () => {
            window.location.href = "register.html";
        });
    }

    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            if(!emailInput.value || !passwordInput.value) return alert("กรุณากรอกข้อมูลให้ครบถ้วน");
            signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value)
                .then(() => {
                    window.location.href = "home.html";
                })
                .catch(error => alert("อีเมลหรือรหัสผ่านไม่ถูกต้อง"));
        });
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            window.location.href = "home.html";
        }
    });
}

// --- หน้า home.html ---
if (path.includes("home.html")) {
    const userEmailSpan = document.getElementById('userEmail');
    const logoutBtn = document.getElementById('logoutBtn');
    let currentUser = null;

    let cart = JSON.parse(localStorage.getItem('sleepycat_cart')) || [];
    let orders = JSON.parse(localStorage.getItem('sleepycat_orders')) || [];

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            if(userEmailSpan) userEmailSpan.innerText = `ยินดีต้อนรับ: ${user.email}`;
            updateCartUI();
        } else {
            window.location.href = "index.html";
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            signOut(auth).then(() => {
                window.location.href = "index.html";
            });
        });
    }

    // --- ระบบกดหมวดหมู่ และ ค้นหาสินค้า ---
    const categoryCards = document.querySelectorAll('.category-card');
    const productCards = document.querySelectorAll('.product-card');
    const productSectionTitle = document.getElementById('productSectionTitle');
    const resetFilterBtn = document.getElementById('resetFilterBtn');
    const showAllCatBtn = document.getElementById('showAllCatBtn');
    const showAllProdBtn = document.getElementById('showAllProdBtn');
    const navHomeBtn = document.getElementById('navHomeBtn');
    const navCategoryBtn = document.getElementById('navCategoryBtn');
    const logoHomeBtn = document.getElementById('logoHomeBtn');
    const searchInput = document.getElementById('searchInput');

    const categoryNames = {
        all: 'สินค้าทั้งหมด',
        women: 'หมวดหมู่: ชุดนอนผู้หญิง',
        men: 'หมวดหมู่: ชุดนอนผู้ชาย',
        kids: 'หมวดหมู่: ชุดนอนเด็ก',
        dress: 'หมวดหมู่: เดรส/กระโปรงนอน',
        bedroom: 'หมวดหมู่: ของใช้ในห้องนอน'
    };

    let activeCategory = 'all';

    function filterProducts(category, searchTerm = '') {
        activeCategory = category;
        const keyword = searchTerm.trim().toLowerCase();

        // ไฮไลต์การ์ดหมวดหมู่ที่เลือก
        categoryCards.forEach(card => {
            if (card.dataset.category === category) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });

        // แสดง/ซ่อนสินค้าตามเงื่อนไข
        productCards.forEach(card => {
            const cardCat = card.dataset.category;
            const cardName = card.dataset.name.toLowerCase();
            const matchCat = (category === 'all' || cardCat === category);
            const matchSearch = (!keyword || cardName.includes(keyword));

            card.style.display = (matchCat && matchSearch) ? 'block' : 'none';
        });

        // อัปเดตหัวข้อและปุ่มรีเซ็ต
        if (productSectionTitle) {
            if (keyword) {
                productSectionTitle.innerText = `ผลการค้นหา "${searchTerm}"`;
            } else {
                productSectionTitle.innerText = categoryNames[category] || 'สินค้าทั้งหมด';
            }
        }

        if (resetFilterBtn) {
            resetFilterBtn.style.display = (category !== 'all' || keyword !== '') ? 'inline-block' : 'none';
        }
    }

    // คลิกที่การ์ดหมวดหมู่ทั้ง 5 หมวด
    categoryCards.forEach(card => {
        card.addEventListener('click', () => {
            const selectedCat = card.dataset.category;
            if (searchInput) searchInput.value = '';

            // ถ้ากดซ้ำหมวดเดิม ให้กลับไปแสดงทั้งหมด
            if (activeCategory === selectedCat) {
                filterProducts('all');
            } else {
                filterProducts(selectedCat);
                const prodSec = document.getElementById('productsSection');
                if (prodSec) prodSec.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // ปุ่มดูทั้งหมด / แสดงทั้งหมด / หน้าแรก
    const resetAllFilters = (e) => {
        if (e) e.preventDefault();
        if (searchInput) searchInput.value = '';
        filterProducts('all');
        if (navHomeBtn && navCategoryBtn) {
            navHomeBtn.classList.add('active');
            navCategoryBtn.classList.remove('active');
        }
    };

    if (resetFilterBtn) resetFilterBtn.addEventListener('click', resetAllFilters);
    if (showAllCatBtn) showAllCatBtn.addEventListener('click', resetAllFilters);
    if (showAllProdBtn) showAllProdBtn.addEventListener('click', resetAllFilters);
    if (logoHomeBtn) logoHomeBtn.addEventListener('click', () => {
        resetAllFilters();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    if (navHomeBtn) {
        navHomeBtn.addEventListener('click', (e) => {
            resetAllFilters(e);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    if (navCategoryBtn) {
        navCategoryBtn.addEventListener('click', () => {
            if (navHomeBtn) navHomeBtn.classList.remove('active');
            navCategoryBtn.classList.add('active');
        });
    }

    // ค้นหาสินค้าแบบเรียลไทม์
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterProducts(activeCategory, e.target.value);
        });
    }

    // ปุ่มกดถูกใจ (หัวใจ)
    document.querySelectorAll('.heart-icon').forEach(heart => {
        heart.addEventListener('click', () => {
            heart.classList.toggle('liked');
            heart.classList.toggle('fas');
            heart.classList.toggle('far');
        });
    });

    // --- ระบบตะกร้าสินค้า ---
    const cartIcon = document.getElementById('cartIcon');
    const cartDrawer = document.getElementById('cartDrawer');
    const closeCartBtn = document.getElementById('closeCartBtn');
    const cartItemsList = document.getElementById('cartItemsList');
    const cartCount = document.getElementById('cartCount');
    const cartTotalPrice = document.getElementById('cartTotalPrice');
    const openPaymentBtn = document.getElementById('openPaymentBtn');

    const paymentModal = document.getElementById('paymentModal');
    const closePayBtn = document.getElementById('closePayBtn');
    const confirmPayBtn = document.getElementById('confirmPayBtn');
    const payTotalAmount = document.getElementById('payTotalAmount');
    const payQr = document.getElementById('payQr');
    const payCod = document.getElementById('payCod');
    const labelQr = document.getElementById('labelQr');
    const labelCod = document.getElementById('labelCod');
    const qrContainer = document.getElementById('qrContainer');
    const codContainer = document.getElementById('codContainer');
    const promptpayQrCodeEl = document.getElementById('promptpayQrCode');

    const trackingModal = document.getElementById('trackingModal');
    const trackOrdersBtn = document.getElementById('trackOrdersBtn');
    const trackIconBtn = document.getElementById('trackIconBtn');
    const closeTrackBtn = document.getElementById('closeTrackBtn');
    const ordersListContainer = document.getElementById('ordersListContainer');

    if (cartIcon) cartIcon.addEventListener('click', () => cartDrawer.classList.add('open'));
    if (closeCartBtn) closeCartBtn.addEventListener('click', () => cartDrawer.classList.remove('open'));

    const addBtns = document.querySelectorAll('.add-cart-btn');
    addBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.product-card');
            const id = card.dataset.id;
            const name = card.dataset.name;
            const price = parseFloat(card.dataset.price);

            const existing = cart.find(item => item.id === id);
            if (existing) {
                existing.qty += 1;
            } else {
                cart.push({ id, name, price, qty: 1 });
            }

            saveCart();
            updateCartUI();
            cartDrawer.classList.add('open');
        });
    });

    function saveCart() {
        localStorage.setItem('sleepycat_cart', JSON.stringify(cart));
    }

    function updateCartUI() {
        if (!cartItemsList) return;
        cartItemsList.innerHTML = '';
        let total = 0;
        let count = 0;

        if (cart.length === 0) {
            cartItemsList.innerHTML = '<p style="text-align:center; color:#888; margin-top:30px;">ไม่มีสินค้าในตะกร้า</p>';
        } else {
            cart.forEach((item, index) => {
                total += item.price * item.qty;
                count += item.qty;

                const itemEl = document.createElement('div');
                itemEl.className = 'cart-item';
                itemEl.innerHTML = `
                    <div>
                        <strong style="font-size:14px; display:block;">${item.name}</strong>
                        <span style="font-size:12px; color:#666;">฿${item.price} x ${item.qty}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-weight:bold; font-size:14px;">฿${item.price * item.qty}</span>
                        <i class="fas fa-trash" style="color:#ff6b6b; cursor:pointer;" data-index="${index}"></i>
                    </div>
                `;
                cartItemsList.appendChild(itemEl);
            });
        }

        if (cartCount) cartCount.innerText = count;
        if (cartTotalPrice) cartTotalPrice.innerText = total.toLocaleString();

        const deleteIcons = cartItemsList.querySelectorAll('.fa-trash');
        deleteIcons.forEach(icon => {
            icon.addEventListener('click', (e) => {
                const idx = e.target.dataset.index;
                cart.splice(idx, 1);
                saveCart();
                updateCartUI();
            });
        });
    }

    // Toggle สลับปุ่มตัวเลือกการชำระเงิน (QR Code vs COD)
    if (labelQr && labelCod) {
        labelQr.addEventListener('click', () => {
            payQr.checked = true;
            labelQr.classList.add('active');
            labelCod.classList.remove('active');
            if(qrContainer) qrContainer.style.display = 'block';
            if(codContainer) codContainer.style.display = 'none';
        });
        labelCod.addEventListener('click', () => {
            payCod.checked = true;
            labelCod.classList.add('active');
            labelQr.classList.remove('active');
            if(qrContainer) qrContainer.style.display = 'none';
            if(codContainer) codContainer.style.display = 'block';
        });
    }

    if (openPaymentBtn) {
        openPaymentBtn.addEventListener('click', () => {
            if (cart.length === 0) return alert("กรุณาเลือกสินค้าเข้าตะกร้าก่อนทำรายการ");
            const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
            payTotalAmount.innerText = total.toLocaleString();

            // สร้าง QR Code พร้อมเพย์เบอร์ 0957728750 ตามยอดเงินรวม
            if (promptpayQrCodeEl && typeof QRCode !== 'undefined') {
                promptpayQrCodeEl.innerHTML = '';
                const payload = generatePromptPayPayload('0957728750', total);
                new QRCode(promptpayQrCodeEl, {
                    text: payload,
                    width: 180,
                    height: 180,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
                });
            }

            cartDrawer.classList.remove('open');
            paymentModal.classList.add('show');
        });
    }

    if (closePayBtn) {
        closePayBtn.addEventListener('click', () => paymentModal.classList.remove('show'));
    }

    // ยืนยันคำสั่งซื้อ
    if (confirmPayBtn) {
        confirmPayBtn.addEventListener('click', () => {
            const nameEl = document.getElementById('custName');
            const phoneEl = document.getElementById('custPhone');
            const addressEl = document.getElementById('custAddress');

            const name = nameEl ? nameEl.value.trim() : '';
            const phone = phoneEl ? phoneEl.value.trim() : '';
            const address = addressEl ? addressEl.value.trim() : '';

            const selectedPayRadio = document.querySelector('input[name="payMethod"]:checked');
            const payMethod = selectedPayRadio ? selectedPayRadio.value : 'qr';

            if (!name || !phone || !address) {
                return alert("กรุณากรอกข้อมูลการจัดส่งให้ครบถ้วน");
            }

            const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
            const trackingNo = "TH-CAT" + Math.floor(10000000 + Math.random() * 90000000);
            
            const newOrder = {
                orderId: "CAT-" + Math.floor(100000 + Math.random() * 900000),
                trackingNo: trackingNo,
                userEmail: currentUser ? currentUser.email : "Guest",
                items: [...cart],
                totalAmount: total,
                name: name,
                phone: phone,
                address: address,
                paymentMethod: payMethod === 'cod' ? 'เก็บเงินปลายทาง (COD)' : 'โอนเงิน (QR Code)',
                step: 1,
                date: new Date().toLocaleString('th-TH')
            };

            orders.unshift(newOrder);
            localStorage.setItem('sleepycat_orders', JSON.stringify(orders));

            cart = [];
            saveCart();
            updateCartUI();

            paymentModal.classList.remove('show');
            alert(`🎉 สั่งซื้อสำเร็จ!\nรหัสคำสั่งซื้อ: ${newOrder.orderId}\nเลขพัสดุ: ${newOrder.trackingNo}\nวิธีชำระเงิน: ${newOrder.paymentMethod}`);
            renderOrders();
            trackingModal.classList.add('show');
        });
    }

    const openTracking = () => {
        renderOrders();
        trackingModal.classList.add('show');
    };

    if (trackOrdersBtn) trackOrdersBtn.addEventListener('click', (e) => { e.preventDefault(); openTracking(); });
    if (trackIconBtn) trackIconBtn.addEventListener('click', openTracking);
    if (closeTrackBtn) closeTrackBtn.addEventListener('click', () => trackingModal.classList.remove('show'));

    const statusMap = {
        1: { title: "รับออเดอร์แล้ว", icon: "fa-file-invoice", color: "#e67e22" },
        2: { title: "กำลังแพ็คสินค้า", icon: "fa-box-open", color: "#3498db" },
        3: { title: "บริษัทขนส่งรับพัสดุแล้ว", icon: "fa-truck", color: "#9b59b6" },
        4: { title: "จัดส่งสำเร็จเรียบร้อย", icon: "fa-check-circle", color: "#2ecc71" }
    };

    function renderOrders() {
        if (!ordersListContainer) return;
        ordersListContainer.innerHTML = '';

        orders = JSON.parse(localStorage.getItem('sleepycat_orders')) || [];
        const userOrders = orders.filter(o => !currentUser || o.userEmail === currentUser.email);

        if (userOrders.length === 0) {
            ordersListContainer.innerHTML = '<p style="text-align:center; color:#888; margin:20px 0;">ยังไม่มีประวัติการสั่งซื้อ</p>';
            return;
        }

        userOrders.forEach(order => {
            const orderEl = document.createElement('div');
            orderEl.className = 'order-card';
            
            const itemListHtml = order.items.map(i => `${i.name} (x${i.qty})`).join(', ');
            const isCod = order.paymentMethod.includes('COD');
            
            const currentStep = order.step || 1;
            const currentStatus = statusMap[currentStep] || statusMap[1];

            orderEl.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div>
                        <strong style="font-size:15px; color:#8b5a2b;">#${order.orderId}</strong>
                        <span style="font-size:12px; color:#888; display:block;">เลขพัสดุ: <b>${order.trackingNo}</b></span>
                    </div>
                    <span class="status-badge ${isCod ? 'cod' : ''}">${order.paymentMethod}</span>
                </div>
                <p style="font-size:12px; color:#666; margin: 4px 0;">วันที่สั่งซื้อ: ${order.date}</p>
                <p style="font-size:13px; margin: 4px 0;">รายการ: ${itemListHtml}</p>
                <p style="font-size:14px; margin: 6px 0; font-weight:bold; color:var(--primary-brown);">ยอดชำระ: ฿${order.totalAmount.toLocaleString()}</p>
                <p style="font-size:11px; color:#666; margin: 2px 0 15px 0;">จัดส่งถึง: ${order.name} (${order.phone}) ${order.address}</p>
                
                <div style="background: #fafafa; border: 1px solid #eee; padding: 12px; border-radius: 8px; display: flex; align-items: center; gap: 12px;">
                    <div style="width: 38px; height: 38px; background: ${currentStatus.color}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                        <i class="fas ${currentStatus.icon}"></i>
                    </div>
                    <div>
                        <span style="font-size: 11px; color: #888; display: block;">สถานะการจัดส่งปัจจุบัน</span>
                        <strong style="font-size: 14px; color: ${currentStatus.color};">${currentStatus.title}</strong>
                    </div>
                </div>
            `;
            ordersListContainer.appendChild(orderEl);
        });
    }
}