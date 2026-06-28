/* ====================================================
   MERCYCARE HOSPITAL - FRONTEND ENGINE
   ==================================================== */

const API_BASE = '../backend/api.php';

// Core State Management
let currentUser = null;
let activeTab = 'patient-dashboard';
let systemTimeInterval = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initLandingPage();
    checkAuthSession();
    registerGlobalEvents();
});

// ====================================================
// PUBLIC LANDING PAGE CAROUSEL & ANIMATION LOGIC
// ====================================================

function initLandingPage() {
    // Dynamic Stats Count-Up Animation
    const statsSection = document.querySelector('.stats-section');
    if (statsSection) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCountUp('stat-doctors', 45);
                    animateCountUp('stat-patients', 12000);
                    animateCountUp('stat-success', 98);
                    animateCountUp('stat-years', 20);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
        observer.observe(statsSection);
    }

    // Scroll Active Header effect
    window.addEventListener('scroll', () => {
        const header = document.getElementById('main-header');
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // Public Contact Form
    const contactForm = document.getElementById('public-contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            showToast('Success', 'Your message has been sent! Our support team will respond shortly.', 'success');
            contactForm.reset();
        });
    }

    // Fetch and render doctors in landing page list
    loadPublicDoctors();
}

// Count up utility
function animateCountUp(elementId, targetValue) {
    const el = document.getElementById(elementId);
    if (!el) return;
    let count = 0;
    const duration = 1500; // 1.5s duration
    const speed = Math.ceil(targetValue / (duration / 30));
    
    const ticker = setInterval(() => {
        count += speed;
        if (count >= targetValue) {
            el.innerText = targetValue.toLocaleString();
            clearInterval(ticker);
        } else {
            el.innerText = count.toLocaleString();
        }
    }, 30);
}

// Fetch public doctors
async function loadPublicDoctors() {
    const container = document.getElementById('public-doctors-list');
    if (!container) return;

    try {
        const res = await fetch(`${API_BASE}/doctors`);
        if (!res.ok) throw new Error('Failed to load specialists list');
        
        const doctors = await res.json();
        container.innerHTML = '';
        
        if (doctors.length === 0) {
            container.innerHTML = '<div class="no-records">No medical specialists registered at this time.</div>';
            return;
        }

        doctors.forEach(doc => {
            const profile = doc.doctorProfile || {};
            const card = document.createElement('div');
            card.className = 'doc-card fade-in';
            card.innerHTML = `
                <div class="doc-img-box">
                    <img src="${profile.imageUrl || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=600'}" alt="${doc.name}" class="doc-img">
                    <span class="doc-overlay-badge">${profile.experience || '8 Years'} Exp</span>
                </div>
                <div class="doc-info">
                    <h3>${doc.name}</h3>
                    <span class="doc-specialty">${profile.specialization || 'General Practitioner'}</span>
                    <p class="doc-bio">${profile.bio || 'Accredited medical practitioner providing high quality support and diagnostics.'}</p>
                    <div class="doc-schedule">
                        <i class="fa-regular fa-clock"></i>
                        <span>${profile.schedule || 'Available by booking'}</span>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="no-records text-danger"><i class="fa-solid fa-triangle-exclamation"></i> Could not connect to database. Make sure backend service is running!</div>`;
    }
}

// ====================================================
// AUTHENTICATION & SESSION MANAGEMENT
// ====================================================

async function checkAuthSession() {
    const token = localStorage.getItem('mercycare_token');
    if (!token) {
        switchToPublicView();
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) {
            // Token expired or invalid
            localStorage.removeItem('mercycare_token');
            switchToPublicView();
            return;
        }

        const user = await res.json();
        currentUser = user;
        switchToPortalView();
    } catch (err) {
        console.error('Session verification failed:', err);
        switchToPublicView();
    }
}

// Switch navigation view modes
function switchToPublicView() {
    document.getElementById('public-view').classList.remove('hidden');
    document.getElementById('portal-view').classList.add('hidden');
    document.getElementById('main-header').classList.remove('hidden');
    document.getElementById('nav-portal-text').innerText = 'HMS Portal';
    
    if (systemTimeInterval) {
        clearInterval(systemTimeInterval);
        systemTimeInterval = null;
    }
}

function switchToPortalView() {
    if (!currentUser) return;
    
    document.getElementById('public-view').classList.add('hidden');
    document.getElementById('portal-view').classList.remove('hidden');
    document.getElementById('main-header').classList.add('hidden');
    
    // Set Sidebar User Details
    document.getElementById('portal-user-name').innerText = currentUser.name;
    document.getElementById('portal-avatar').innerText = currentUser.name.charAt(0).toUpperCase();
    
    // Normalize and Capitalize role
    const roleCapitalized = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
    document.getElementById('portal-user-role').innerText = roleCapitalized;
    
    // Configure Menu tabs visibility based on roles
    document.getElementById('patient-menu-links').classList.add('hidden');
    document.getElementById('doctor-menu-links').classList.add('hidden');
    document.getElementById('admin-menu-links').classList.add('hidden');
    
    if (currentUser.role === 'patient') {
        document.getElementById('patient-menu-links').classList.remove('hidden');
        activeTab = 'patient-dashboard';
    } else if (currentUser.role === 'doctor') {
        document.getElementById('doctor-menu-links').classList.remove('hidden');
        activeTab = 'doctor-dashboard';
    } else if (currentUser.role === 'admin') {
        document.getElementById('admin-menu-links').classList.remove('hidden');
        activeTab = 'admin-dashboard';
    }

    // Toggle active classes in menu buttons
    document.querySelectorAll('.nav-menu-item').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === activeTab) {
            btn.classList.add('active');
        }
    });

    // Start Live Clock
    initPortalClock();

    // Trigger tab render loading
    loadTabContent(activeTab);
}

// Clock logic
function initPortalClock() {
    if (systemTimeInterval) clearInterval(systemTimeInterval);
    const clockLabel1 = document.getElementById('current-portal-time');
    
    function updateClock() {
        const now = new Date();
        const dateStr = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (clockLabel1) {
            clockLabel1.innerHTML = `<i class="fa-regular fa-clock icon-left"></i> ${dateStr} • ${timeStr}`;
        }
    }
    
    updateClock();
    systemTimeInterval = setInterval(updateClock, 1000);
}

// ====================================================
// CORE TAB CONTENT ROUTER
// ====================================================

function loadTabContent(tabName) {
    // Hide all tab panes
    document.querySelectorAll('.portal-tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });

    const targetPane = document.getElementById(`tab-${tabName}`);
    if (targetPane) {
        targetPane.classList.add('active');
    }

    // Set page subtitle and title dynamically
    const tabTitleEl = document.getElementById('portal-tab-title');
    const tabSubEl = document.getElementById('portal-tab-subtitle');

    // Tab switcher cases
    switch(tabName) {
        case 'patient-dashboard':
            tabTitleEl.innerText = 'Patient Dashboard';
            tabSubEl.innerText = 'Electronic health diagnostics summaries';
            loadPatientDashboardData();
            break;
        case 'patient-appointments':
            tabTitleEl.innerText = 'Consultation Bookings';
            tabSubEl.innerText = 'Schedule online consultation with specialists';
            loadPatientAppointmentsTab();
            break;
        case 'patient-prescriptions':
            tabTitleEl.innerText = 'My Medical Prescriptions';
            tabSubEl.innerText = 'Active medications prescribed by doctors';
            loadPatientPrescriptionsTab();
            break;
        case 'patient-billing':
            tabTitleEl.innerText = 'Financial Billings';
            tabSubEl.innerText = 'Settle clinic checkup invoices & bills';
            loadPatientBillingTab();
            break;

        case 'doctor-dashboard':
            tabTitleEl.innerText = 'Specialist Operations';
            tabSubEl.innerText = 'Manage today\'s assigned clinic visits';
            loadDoctorDashboardData();
            break;
        case 'doctor-appointments':
            tabTitleEl.innerText = 'Assigned Duty Schedule';
            tabSubEl.innerText = 'Historical database of consultations';
            loadDoctorScheduleTab();
            break;

        case 'admin-dashboard':
            tabTitleEl.innerText = 'HMS Control Center';
            tabSubEl.innerText = 'System telemetry parameters and global metrics';
            loadAdminDashboardData();
            break;
        case 'admin-doctors':
            tabTitleEl.innerText = 'Manage Specialists';
            tabSubEl.innerText = 'Register, edit and coordinate hospital clinical directories';
            loadAdminDoctorsTab();
            break;
        case 'admin-patients':
            tabTitleEl.innerText = 'EMR Patient Database';
            tabSubEl.innerText = 'Access and audit clinical patient charts';
            loadAdminPatientsTab();
            break;
        case 'admin-appointments':
            tabTitleEl.innerText = 'Global Appointments Auditor';
            tabSubEl.innerText = 'Schedule controls across all specialists';
            loadAdminAppointmentsTab();
            break;
        case 'admin-billing':
            tabTitleEl.innerText = 'Invoices Center';
            tabSubEl.innerText = 'Issue invoice charges and monitor transactions';
            loadAdminBillingTab();
            break;
        case 'admin-beds':
            tabTitleEl.innerText = 'Ward Beds Allocations';
            tabSubEl.innerText = 'Hospital bed allocations map (ICU, Wards)';
            loadAdminBedsTab();
            break;
    }
}

// ====================================================
// TAB SPECIFIC LOGIC: PATIENT MODULE
// ====================================================

async function loadPatientDashboardData() {
    const token = localStorage.getItem('mercycare_token');
    
    // Set Welcomes
    document.getElementById('pb-patient-name').innerText = currentUser.name;

    try {
        // Stats
        const sRes = await fetch(`${API_BASE}/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (sRes.ok) {
            const stats = await sRes.json();
            document.getElementById('pkpi-apps').innerText = stats.totalAppointments;
            document.getElementById('pkpi-presc').innerText = stats.prescriptionCount;
            document.getElementById('pkpi-bills').innerText = stats.unpaidInvoices;
        }

        // Profile EMR info
        const meRes = await fetch(`${API_BASE}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (meRes.ok) {
            const user = await meRes.json();
            currentUser = user; // refresh
            const emr = user.patientProfile || {};
            
            document.getElementById('emr-dob').innerText = emr.dateOfBirth || 'Not set';
            document.getElementById('emr-gender').innerText = emr.gender || 'Not set';
            document.getElementById('emr-blood').innerText = emr.bloodType || 'Not set';
            document.getElementById('emr-phone').innerText = emr.phone || 'Not set';
            document.getElementById('emr-address').innerText = emr.address || 'Not set';
            document.getElementById('emr-allergies').innerText = emr.allergies || 'None reported';
            document.getElementById('emr-chronic').innerText = emr.chronicConditions || 'None reported';
        }

        // Recent appointments
        const aRes = await fetch(`${API_BASE}/appointments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (aRes.ok) {
            const apps = await aRes.json();
            const list = document.getElementById('patient-dashboard-appointments');
            list.innerHTML = '';
            
            if (apps.length === 0) {
                list.innerHTML = '<div class="no-records">No recent appointments.</div>';
                return;
            }

            // Show latest 3
            apps.slice(0, 3).forEach(app => {
                const row = document.createElement('div');
                row.className = 'simple-record-row';
                row.innerHTML = `
                    <div class="record-details">
                        <h4>${app.doctor ? app.doctor.name : 'Unknown Specialist'}</h4>
                        <p>${app.appointmentDate} at ${app.appointmentTime}</p>
                    </div>
                    <span class="status-badge badge-${app.status}">${app.status}</span>
                `;
                list.appendChild(row);
            });
        }
    } catch (err) {
        console.error(err);
    }
}

async function loadPatientAppointmentsTab() {
    const token = localStorage.getItem('mercycare_token');
    
    // Load Doctors Select option
    try {
        const dRes = await fetch(`${API_BASE}/doctors`);
        const select = document.getElementById('pbook-doctor');
        select.innerHTML = '';
        if (dRes.ok) {
            const docs = await dRes.json();
            docs.forEach(doc => {
                const spec = doc.doctorProfile ? doc.doctorProfile.specialization : 'Specialist';
                select.innerHTML += `<option value="${doc.id}">${doc.name} (${spec})</option>`;
            });
        }
    } catch (err) { console.error(err); }

    // Load Appointments List
    try {
        const res = await fetch(`${API_BASE}/appointments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const tbody = document.getElementById('patient-appointments-list');
        tbody.innerHTML = '';
        
        if (res.ok) {
            const apps = await res.json();
            if (apps.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No appointments found.</td></tr>`;
                return;
            }
            
            apps.forEach(app => {
                let actBtn = '';
                if (app.status === 'pending' || app.status === 'approved') {
                    actBtn = `<button class="btn btn-sm btn-danger" onclick="cancelAppointment(${app.id})">Cancel</button>`;
                }
                
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${app.doctor ? app.doctor.name : 'Unknown'}</strong></td>
                        <td>${app.appointmentDate}<br><span class="text-muted" style="font-size:0.8rem;">${app.appointmentTime}</span></td>
                        <td>${app.chiefComplaint}</td>
                        <td><span class="status-badge badge-${app.status}">${app.status}</span></td>
                        <td>${actBtn}</td>
                    </tr>
                `;
            });
        }
    } catch (err) { console.error(err); }
}

async function loadPatientPrescriptionsTab() {
    const token = localStorage.getItem('mercycare_token');
    try {
        const res = await fetch(`${API_BASE}/prescriptions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const tbody = document.getElementById('patient-prescriptions-list');
        tbody.innerHTML = '';

        if (res.ok) {
            const pre = await res.json();
            if (pre.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No active medications prescribed.</td></tr>`;
                return;
            }

            pre.forEach(p => {
                const app = p.appointment || {};
                const docName = app.doctor ? app.doctor.name : 'Specialist';
                const date = app.appointmentDate || 'N/A';
                tbody.innerHTML += `
                    <tr>
                        <td>${date}</td>
                        <td><strong>${docName}</strong></td>
                        <td>${p.diagnosis}</td>
                        <td><span class="text-teal">${p.medication}</span></td>
                        <td>${p.dosage}</td>
                        <td>${p.instructions || 'Follow prescription cycles carefully.'}</td>
                    </tr>
                `;
            });
        }
    } catch (err) { console.error(err); }
}

async function loadPatientBillingTab() {
    const token = localStorage.getItem('mercycare_token');
    try {
        const res = await fetch(`${API_BASE}/billing`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const tbody = document.getElementById('patient-billing-list');
        tbody.innerHTML = '';

        if (res.ok) {
            const bills = await res.json();
            if (bills.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No billing invoices found.</td></tr>`;
                return;
            }

            bills.forEach(bill => {
                let act = '';
                if (bill.status === 'unpaid') {
                    act = `<button class="btn btn-sm btn-primary" onclick="payBill(${bill.id})">Pay Now</button>`;
                }
                tbody.innerHTML += `
                    <tr>
                        <td>#${bill.id}</td>
                        <td>${bill.description}</td>
                        <td><strong>$${parseFloat(bill.amount).toFixed(2)}</strong></td>
                        <td>${bill.dueDate}</td>
                        <td><span class="status-badge badge-${bill.status}">${bill.status}</span></td>
                        <td>${act}</td>
                    </tr>
                `;
            });
        }
    } catch (err) { console.error(err); }
}

// Global actions triggers
window.cancelAppointment = async function(id) {
    const token = localStorage.getItem('mercycare_token');
    if (!confirm('Are you sure you want to cancel this appointment request?')) return;
    
    try {
        const res = await fetch(`${API_BASE}/appointments/${id}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'cancelled' })
        });
        
        if (res.ok) {
            showToast('Cancelled', 'Consultation cancelled successfully.', 'success');
            loadTabContent(activeTab);
        } else {
            showToast('Error', 'Failed to cancel appointment.', 'error');
        }
    } catch (err) { console.error(err); }
}

window.payBill = async function(id) {
    const token = localStorage.getItem('mercycare_token');
    try {
        const res = await fetch(`${API_BASE}/billing/${id}/pay`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            showToast('Settled', 'Simulated transaction completed successfully. Bill status marked as PAID.', 'success');
            loadTabContent(activeTab);
        } else {
            showToast('Error', 'Payment processing failed.', 'error');
        }
    } catch (err) { console.error(err); }
}

// ====================================================
// TAB SPECIFIC LOGIC: DOCTOR MODULE
// ====================================================

async function loadDoctorDashboardData() {
    const token = localStorage.getItem('mercycare_token');
    try {
        // stats
        const resStats = await fetch(`${API_BASE}/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resStats.ok) {
            const stats = await resStats.json();
            document.getElementById('dkpi-pending').innerText = stats.pendingAppointments;
            document.getElementById('dkpi-completed').innerText = stats.totalConsultations;
        }

        // Today's schedule
        const resApps = await fetch(`${API_BASE}/appointments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resApps.ok) {
            const apps = await resApps.json();
            const tbody = document.getElementById('doctor-appointments-today');
            tbody.innerHTML = '';

            const todayStr = new Date().toISOString().split('T')[0];
            const todayApps = apps.filter(a => a.appointmentDate === todayStr || a.status === 'pending' || a.status === 'approved');

            if (todayApps.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No appointments scheduled for today.</td></tr>`;
                return;
            }

            todayApps.forEach(app => {
                let controls = '';
                if (app.status === 'pending') {
                    controls = `
                        <button class="btn btn-sm btn-outline mr-2" onclick="updateAppointmentStatus(${app.id}, 'approved')" style="margin-right:6px;">Confirm</button>
                        <button class="btn btn-sm btn-danger" onclick="updateAppointmentStatus(${app.id}, 'cancelled')">Cancel</button>
                    `;
                } else if (app.status === 'approved') {
                    controls = `
                        <button class="btn btn-sm btn-primary" onclick="triggerDiagnoseModal(${app.id}, '${app.patient ? app.patient.name : 'Patient'}')">Diagnose & Prescribe</button>
                    `;
                }

                tbody.innerHTML += `
                    <tr>
                        <td><strong>${app.patient ? app.patient.name : 'Unknown Patient'}</strong></td>
                        <td>${app.appointmentDate}<br><span class="text-muted" style="font-size:0.8rem;">${app.appointmentTime}</span></td>
                        <td>${app.chiefComplaint}</td>
                        <td><span class="status-badge badge-${app.status}">${app.status}</span></td>
                        <td>${controls}</td>
                    </tr>
                `;
            });
        }
    } catch (err) { console.error(err); }
}

async function loadDoctorScheduleTab() {
    const token = localStorage.getItem('mercycare_token');
    try {
        const res = await fetch(`${API_BASE}/appointments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const tbody = document.getElementById('doctor-appointments-all');
        tbody.innerHTML = '';

        if (res.ok) {
            const apps = await res.json();
            if (apps.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No schedule archives found.</td></tr>`;
                return;
            }

            apps.forEach(app => {
                const diagnosis = app.prescription ? app.prescription.diagnosis : (app.notes || 'No diagnostics recorded');
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${app.patient ? app.patient.name : 'Patient'}</strong></td>
                        <td>${app.appointmentDate}<br><span class="text-muted" style="font-size:0.8rem;">${app.appointmentTime}</span></td>
                        <td>${app.chiefComplaint}</td>
                        <td>${diagnosis}</td>
                        <td><span class="status-badge badge-${app.status}">${app.status}</span></td>
                    </tr>
                `;
            });
        }
    } catch (err) { console.error(err); }
}

window.updateAppointmentStatus = async function(id, newStatus) {
    const token = localStorage.getItem('mercycare_token');
    try {
        const res = await fetch(`${API_BASE}/appointments/${id}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
        });
        if (res.ok) {
            showToast('Updated', `Consultation marked as ${newStatus}.`, 'success');
            loadTabContent(activeTab);
        } else {
            showToast('Error', 'Failed to update schedule status.', 'error');
        }
    } catch (err) { console.error(err); }
}

window.triggerDiagnoseModal = function(appId, patientName) {
    document.getElementById('diag-app-id').value = appId;
    document.getElementById('diag-patient-name').innerText = patientName;
    document.getElementById('doctor-diagnose-form').reset();
    document.getElementById('diagnose-modal').classList.remove('hidden');
}

// ====================================================
// TAB SPECIFIC LOGIC: ADMIN CONTROL CENTER
// ====================================================

async function loadAdminDashboardData() {
    const token = localStorage.getItem('mercycare_token');
    try {
        const res = await fetch(`${API_BASE}/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            const stats = await res.json();
            
            document.getElementById('akpi-patients').innerText = stats.activePatients;
            document.getElementById('akpi-doctors').innerText = stats.activeDoctors;
            document.getElementById('akpi-pending').innerText = stats.pendingAppointments;
            document.getElementById('akpi-revenue').innerText = `$${parseFloat(stats.revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
            
            // Occupancy percentage bar
            const pct = stats.totalBeds > 0 ? (stats.occupiedBeds / stats.totalBeds) * 100 : 0;
            document.getElementById('admin-beds-progress').style.width = `${pct}%`;
            document.getElementById('admin-beds-text').innerText = `${stats.occupiedBeds} of ${stats.totalBeds} beds occupied (${Math.round(pct)}%)`;
        }

        // Add some telemetry audits
        const tLog = document.getElementById('admin-telemetry-logs');
        tLog.innerHTML = `
            <div class="activity-row">Admin accessed telemetry stats center.<span class="activity-time">${new Date().toLocaleTimeString()}</span></div>
            <div class="activity-row">SQL schema validation passed.<span class="activity-time">Prior Boot</span></div>
            <div class="activity-row">MercyCare HMS DB connected successfully.<span class="activity-time">Prior Boot</span></div>
        `;
    } catch (err) { console.error(err); }
}

async function loadAdminDoctorsTab() {
    const token = localStorage.getItem('mercycare_token');
    // Clear and reset form
    document.getElementById('admin-doctor-form').reset();
    document.getElementById('adoc-id').value = '';
    document.getElementById('adoc-submit-btn').innerText = 'Save Doctor Profile';
    document.getElementById('adoc-pass-group').classList.remove('hidden');
    document.getElementById('adoc-password').required = true;
    document.getElementById('adoc-cancel-btn').classList.add('hidden');
    document.getElementById('admin-doc-form-title').innerText = 'Register New Specialist';

    try {
        const res = await fetch(`${API_BASE}/doctors`);
        const tbody = document.getElementById('admin-doctors-list');
        tbody.innerHTML = '';

        if (res.ok) {
            const docs = await res.json();
            if (docs.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No specialists configured.</td></tr>`;
                return;
            }

            docs.forEach(doc => {
                const profile = doc.doctorProfile || {};
                tbody.innerHTML += `
                    <tr>
                        <td>
                            <strong>${doc.name}</strong><br>
                            <span class="text-muted" style="font-size:0.8rem;">${doc.email}</span>
                        </td>
                        <td>${profile.specialization}</td>
                        <td>${profile.experience}</td>
                        <td>${profile.schedule}</td>
                        <td>
                            <button class="btn btn-sm btn-outline" onclick="editDoctor(${doc.id}, '${doc.name}', '${doc.email}', '${profile.specialization}', '${profile.experience}', '${profile.schedule}', \`${profile.bio ? profile.bio.replace(/'/g, "\\'") : ''}\`, '${profile.imageUrl}')" style="margin-right:6px;"><i class="fa-solid fa-edit"></i></button>
                            <button class="btn btn-sm btn-danger" onclick="deleteDoctor(${doc.id})"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>
                `;
            });
        }
    } catch (err) { console.error(err); }
}

window.editDoctor = function(id, name, email, specialization, experience, schedule, bio, imageUrl) {
    document.getElementById('adoc-id').value = id;
    document.getElementById('adoc-name').value = name;
    document.getElementById('adoc-email').value = email;
    
    // Hide password for edit
    document.getElementById('adoc-pass-group').classList.add('hidden');
    document.getElementById('adoc-password').required = false;
    
    document.getElementById('adoc-special').value = specialization;
    document.getElementById('adoc-exp').value = experience;
    document.getElementById('adoc-schedule').value = schedule;
    document.getElementById('adoc-bio').value = bio || '';
    document.getElementById('adoc-image').value = imageUrl || '';
    
    document.getElementById('adoc-submit-btn').innerText = 'Update Specialist Details';
    document.getElementById('adoc-cancel-btn').classList.remove('hidden');
    document.getElementById('admin-doc-form-title').innerText = 'Edit Specialist Details';
}

window.deleteDoctor = async function(id) {
    const token = localStorage.getItem('mercycare_token');
    if (!confirm('Are you sure you want to delete this doctor profile? All assigned appointments will be unlinked.')) return;
    
    try {
        const res = await fetch(`${API_BASE}/doctors/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            showToast('Deleted', 'Specialist profile deleted.', 'success');
            loadAdminDoctorsTab();
        } else {
            showToast('Error', 'Failed to delete doctor profile.', 'error');
        }
    } catch (err) { console.error(err); }
}

async function loadAdminPatientsTab() {
    const token = localStorage.getItem('mercycare_token');
    try {
        const res = await fetch(`${API_BASE}/patients`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const tbody = document.getElementById('admin-patients-list');
        tbody.innerHTML = '';

        if (res.ok) {
            const patients = await res.json();
            if (patients.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No patient charts registered yet.</td></tr>`;
                return;
            }

            patients.forEach(pat => {
                const emr = pat.patientProfile || {};
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${pat.name}</strong></td>
                        <td>${pat.email}</td>
                        <td>${emr.dateOfBirth || 'N/A'}<br><span class="text-muted" style="font-size:0.8rem;">${emr.gender || 'N/A'}</span></td>
                        <td><span class="text-teal">${emr.bloodType || 'N/A'}</span></td>
                        <td>${emr.phone || 'N/A'}<br><span class="text-muted" style="font-size:0.75rem;">${emr.address || 'N/A'}</span></td>
                        <td>
                            <span class="text-danger" style="font-size:0.8rem;">Allergies: ${emr.allergies || 'None'}</span><br>
                            <span class="text-blue" style="font-size:0.8rem;">Chronic: ${emr.chronicConditions || 'None'}</span>
                        </td>
                    </tr>
                `;
            });
        }
    } catch (err) { console.error(err); }
}

async function loadAdminAppointmentsTab() {
    const token = localStorage.getItem('mercycare_token');
    try {
        const res = await fetch(`${API_BASE}/appointments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const tbody = document.getElementById('admin-appointments-list');
        tbody.innerHTML = '';

        if (res.ok) {
            const apps = await res.json();
            if (apps.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No appointments booked globally.</td></tr>`;
                return;
            }

            apps.forEach(app => {
                let controls = '';
                if (app.status === 'pending') {
                    controls = `
                        <button class="btn btn-sm btn-outline" onclick="updateAppointmentStatus(${app.id}, 'approved')" style="margin-right:6px;">Approve</button>
                        <button class="btn btn-sm btn-danger" onclick="updateAppointmentStatus(${app.id}, 'cancelled')">Cancel</button>
                    `;
                } else if (app.status === 'approved') {
                    controls = `<button class="btn btn-sm btn-danger" onclick="updateAppointmentStatus(${app.id}, 'cancelled')">Cancel</button>`;
                }
                
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${app.patient ? app.patient.name : 'Unknown'}</strong></td>
                        <td>${app.doctor ? app.doctor.name : 'Unassigned'}</td>
                        <td>${app.appointmentDate}<br><span class="text-muted" style="font-size:0.8rem;">${app.appointmentTime}</span></td>
                        <td>${app.chiefComplaint}</td>
                        <td><span class="status-badge badge-${app.status}">${app.status}</span></td>
                        <td>${controls}</td>
                    </tr>
                `;
            });
        }
    } catch (err) { console.error(err); }
}

async function loadAdminBillingTab() {
    const token = localStorage.getItem('mercycare_token');
    
    // Load Patient selection dropdown
    try {
        const pRes = await fetch(`${API_BASE}/patients`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const select = document.getElementById('abill-patient');
        select.innerHTML = '';
        if (pRes.ok) {
            const patients = await pRes.json();
            patients.forEach(pat => {
                select.innerHTML += `<option value="${pat.id}">${pat.name} (${pat.email})</option>`;
            });
        }
    } catch (err) { console.error(err); }

    // Load Invoices
    try {
        const res = await fetch(`${API_BASE}/billing`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const tbody = document.getElementById('admin-billing-list');
        tbody.innerHTML = '';

        if (res.ok) {
            const bills = await res.json();
            if (bills.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No invoice bills generated.</td></tr>`;
                return;
            }

            bills.forEach(bill => {
                const name = bill.patient ? bill.patient.name : 'Patient';
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${name}</strong></td>
                        <td>${bill.description}</td>
                        <td><strong>$${parseFloat(bill.amount).toFixed(2)}</strong></td>
                        <td>${bill.dueDate}</td>
                        <td><span class="status-badge badge-${bill.status}">${bill.status}</span></td>
                    </tr>
                `;
            });
        }
    } catch (err) { console.error(err); }
}

async function loadAdminBedsTab() {
    const token = localStorage.getItem('mercycare_token');
    try {
        const res = await fetch(`${API_BASE}/beds`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const grid = document.getElementById('admin-beds-grid');
        grid.innerHTML = '';

        if (res.ok) {
            const beds = await res.json();
            
            // Group beds by Ward types
            const wards = {
                'General Ward': [],
                'ICU': [],
                'Semi-Private': [],
                'Private': []
            };

            beds.forEach(bed => {
                if (wards[bed.type]) {
                    wards[bed.type].push(bed);
                }
            });

            for (const [wardName, wardBeds] of Object.entries(wards)) {
                if (wardBeds.length === 0) continue;

                const wardContainer = document.createElement('div');
                wardContainer.className = 'ward-container';
                
                let bedsHTML = '';
                wardBeds.forEach(bed => {
                    const patHTML = bed.status === 'occupied' ? `<span class="bed-patient">${bed.patientName || 'Assigned'}</span>` : '';
                    bedsHTML += `
                        <div class="bed-card status-${bed.status}" onclick="triggerBedModal(${bed.id}, '${bed.roomNumber}', '${bed.bedNumber}', '${bed.status}', '${bed.patientName || ''}')">
                            <div class="bed-icon"><i class="fa-solid fa-bed"></i></div>
                            <div class="bed-title">Bed ${bed.roomNumber}-${bed.bedNumber}</div>
                            <div class="bed-type">${bed.type}</div>
                            ${patHTML}
                        </div>
                    `;
                });

                wardContainer.innerHTML = `
                    <h3 class="ward-title">${wardName}</h3>
                    <div class="beds-grid">
                        ${bedsHTML}
                    </div>
                `;
                grid.appendChild(wardContainer);
            }
        }
    } catch (err) { console.error(err); }
}

window.triggerBedModal = function(id, room, bedNum, status, patientName) {
    document.getElementById('abed-id').value = id;
    document.getElementById('abed-label').innerText = `Room ${room} - Bed ${bedNum}`;
    document.getElementById('abed-status').value = status;
    document.getElementById('abed-patient-name').value = patientName;

    // Toggle patient input field based on occupancy
    const patGroup = document.getElementById('abed-patient-group');
    if (status === 'occupied') {
        patGroup.classList.remove('hidden');
    } else {
        patGroup.classList.add('hidden');
    }

    document.getElementById('bed-modal').classList.remove('hidden');
}

// ====================================================
// DIALOGS & OVERLAYS EVENT HANDLERS
// ====================================================

function registerGlobalEvents() {
    // Portal Launchers
    document.querySelectorAll('#nav-btn-portal, #hero-btn-portal, #drawer-btn-portal, #cta-btn-portal').forEach(el => {
        el.addEventListener('click', () => {
            if (currentUser) {
                switchToPortalView();
            } else {
                openAuthModal('login');
            }
        });
    });

    // Bookings direct triggers
    document.querySelectorAll('#nav-btn-book, #hero-btn-book, #drawer-btn-book, #cta-btn-book, #btn-quick-app-trigger, #info-book-link').forEach(el => {
        el.addEventListener('click', () => {
            if (currentUser) {
                switchToPortalView();
                activeTab = 'patient-appointments';
                loadTabContent(activeTab);
            } else {
                openAuthModal('login');
                showToast('Authentication', 'Please login or create a patient portal account to request consultations.', 'error');
            }
        });
    });

    // Mobile menu toggle
    const toggleBtn = document.getElementById('mobile-toggle');
    const drawer = document.getElementById('mobile-drawer');
    const closeDrawerBtn = document.getElementById('mobile-drawer-close');

    if (toggleBtn && drawer && closeDrawerBtn) {
        toggleBtn.addEventListener('click', () => drawer.classList.add('open'));
        closeDrawerBtn.addEventListener('click', () => drawer.classList.remove('open'));
        document.querySelectorAll('.drawer-link').forEach(link => {
            link.addEventListener('click', () => drawer.classList.remove('open'));
        });
    }

    // Modal dismiss triggers
    document.getElementById('btn-close-auth').addEventListener('click', () => document.getElementById('auth-modal').classList.add('hidden'));
    document.getElementById('btn-close-emr-modal').addEventListener('click', () => document.getElementById('emr-modal').classList.add('hidden'));
    document.getElementById('btn-close-diagnose-modal').addEventListener('click', () => document.getElementById('diagnose-modal').classList.add('hidden'));
    document.getElementById('btn-close-bed-modal').addEventListener('click', () => document.getElementById('bed-modal').classList.add('hidden'));

    // Auth toggles
    document.getElementById('auth-toggle-login').addEventListener('click', () => toggleAuthForm('login'));
    document.getElementById('auth-toggle-register').addEventListener('click', () => toggleAuthForm('register'));

    // Submit forms
    document.getElementById('auth-login-form').addEventListener('submit', handleLogin);
    document.getElementById('auth-register-form').addEventListener('submit', handleRegister);
    
    // Patient Form booking
    document.getElementById('portal-booking-form').addEventListener('submit', handleBookAppointment);
    
    // Patient EMR updates
    document.getElementById('btn-edit-emr').addEventListener('click', triggerEmrModal);
    document.getElementById('emr-update-form').addEventListener('submit', handleEmrUpdate);

    // Doctor Diagnoses
    document.getElementById('doctor-diagnose-form').addEventListener('submit', handleDoctorDiagnosis);

    // Admin Bed status select toggle
    document.getElementById('abed-status').addEventListener('change', (e) => {
        const group = document.getElementById('abed-patient-group');
        if (e.target.value === 'occupied') {
            group.classList.remove('hidden');
        } else {
            group.classList.add('hidden');
        }
    });
    document.getElementById('admin-bed-form').addEventListener('submit', handleAdminBedUpdate);

    // Admin doctor CRUD form submit
    document.getElementById('admin-doctor-form').addEventListener('submit', handleDoctorSave);
    document.getElementById('adoc-cancel-btn').addEventListener('click', () => loadAdminDoctorsTab());

    // Admin generate bills invoice
    document.getElementById('admin-billing-form').addEventListener('submit', handleAdminBillGenerate);

    // Admin shortcuts in home dashboard
    document.getElementById('btn-shortcut-doc').addEventListener('click', () => { activeTab = 'admin-doctors'; loadTabContent(activeTab); });
    document.getElementById('btn-shortcut-bill').addEventListener('click', () => { activeTab = 'admin-billing'; loadTabContent(activeTab); });
    document.getElementById('btn-shortcut-beds').addEventListener('click', () => { activeTab = 'admin-beds'; loadTabContent(activeTab); });

    // Sidebar tab buttons routing
    document.querySelectorAll('.nav-menu-item').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-menu-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeTab = btn.getAttribute('data-tab');
            loadTabContent(activeTab);
        });
    });

    // Logout
    document.getElementById('portal-btn-logout').addEventListener('click', () => {
        localStorage.removeItem('mercycare_token');
        currentUser = null;
        switchToPublicView();
        showToast('Session Closed', 'Logged out of portal successfully.', 'success');
    });

    document.getElementById('portal-btn-site').addEventListener('click', () => {
        switchToPublicView();
    });

    // Toast Close
    document.getElementById('toast-close').addEventListener('click', () => {
        document.getElementById('toast-notification').classList.add('hidden');
    });
}

function openAuthModal(mode) {
    document.getElementById('auth-modal').classList.remove('hidden');
    toggleAuthForm(mode);
}

function toggleAuthForm(mode) {
    const lForm = document.getElementById('auth-login-form');
    const rForm = document.getElementById('auth-register-form');
    const lTab = document.getElementById('auth-toggle-login');
    const rTab = document.getElementById('auth-toggle-register');
    const title = document.getElementById('auth-title');

    if (mode === 'login') {
        lForm.classList.remove('hidden');
        rForm.classList.add('hidden');
        lTab.classList.add('active');
        rTab.classList.remove('active');
        title.innerText = 'HMS Portal Login';
    } else {
        lForm.classList.add('hidden');
        rForm.classList.remove('hidden');
        lTab.classList.remove('active');
        rTab.classList.add('active');
        title.innerText = 'Patient Portal Registration';
    }
}

// ====================================================
// ASYNC FORM SUBMISSIONS HANDLERS
// ====================================================

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await res.json();
        if (!res.ok) {
            showToast('Login Failed', data.error || 'Invalid credentials.', 'error');
            return;
        }

        localStorage.setItem('mercycare_token', data.token);
        currentUser = data.user;
        document.getElementById('auth-modal').classList.add('hidden');
        showToast('Authenticated', `Welcome to portal, ${currentUser.name}!`, 'success');
        
        // Retrieve full profile
        await checkAuthSession();
    } catch (err) {
        console.error(err);
        showToast('Connection Error', 'Could not verify authentication credentials.', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const dateOfBirth = document.getElementById('reg-dob').value;
    const gender = document.getElementById('reg-gender').value;
    const phone = document.getElementById('reg-phone').value;

    try {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, dateOfBirth, gender, phone })
        });
        
        const data = await res.json();
        if (!res.ok) {
            showToast('Registration Error', data.error || 'Failed to create patient account.', 'error');
            return;
        }

        localStorage.setItem('mercycare_token', data.token);
        currentUser = data.user;
        document.getElementById('auth-modal').classList.add('hidden');
        showToast('Registered', `Account created successfully, welcome!`, 'success');
        
        await checkAuthSession();
    } catch (err) {
        console.error(err);
        showToast('Connection Error', 'Could not process patient registration.', 'error');
    }
}

async function handleBookAppointment(e) {
    e.preventDefault();
    const token = localStorage.getItem('mercycare_token');
    const doctorId = document.getElementById('pbook-doctor').value;
    const appointmentDate = document.getElementById('pbook-date').value;
    const appointmentTime = document.getElementById('pbook-time').value;
    const chiefComplaint = document.getElementById('pbook-complaint').value;

    try {
        const res = await fetch(`${API_BASE}/appointments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ doctorId, appointmentDate, appointmentTime, chiefComplaint })
        });
        
        if (res.ok) {
            showToast('Scheduled', 'Consultation requested! Waiting for doctor confirmation.', 'success');
            document.getElementById('portal-booking-form').reset();
            loadTabContent(activeTab);
        } else {
            showToast('Error', 'Failed to schedule consultation.', 'error');
        }
    } catch (err) { console.error(err); }
}

function triggerEmrModal() {
    const emr = currentUser.patientProfile || {};
    document.getElementById('emrud-dob').value = emr.dateOfBirth || '';
    document.getElementById('emrud-gender').value = emr.gender || 'Male';
    document.getElementById('emrud-blood').value = emr.bloodType || '';
    document.getElementById('emrud-phone').value = emr.phone || '';
    document.getElementById('emrud-address').value = emr.address || '';
    document.getElementById('emrud-allergies').value = emr.allergies || '';
    document.getElementById('emrud-chronic').value = emr.chronicConditions || '';

    document.getElementById('emr-modal').classList.remove('hidden');
}

async function handleEmrUpdate(e) {
    e.preventDefault();
    const token = localStorage.getItem('mercycare_token');
    const body = {
        dateOfBirth: document.getElementById('emrud-dob').value,
        gender: document.getElementById('emrud-gender').value,
        bloodType: document.getElementById('emrud-blood').value,
        phone: document.getElementById('emrud-phone').value,
        address: document.getElementById('emrud-address').value,
        allergies: document.getElementById('emrud-allergies').value,
        chronicConditions: document.getElementById('emrud-chronic').value
    };

    try {
        const res = await fetch(`${API_BASE}/patients/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });
        
        if (res.ok) {
            showToast('Saved', 'EMR Health profile saved successfully.', 'success');
            document.getElementById('emr-modal').classList.add('hidden');
            await checkAuthSession();
            loadTabContent(activeTab);
        } else {
            showToast('Error', 'Failed to save health profile.', 'error');
        }
    } catch (err) { console.error(err); }
}

async function handleDoctorDiagnosis(e) {
    e.preventDefault();
    const token = localStorage.getItem('mercycare_token');
    const appId = document.getElementById('diag-app-id').value;
    const body = {
        status: 'completed',
        diagnosis: document.getElementById('diag-diagnosis').value,
        medication: document.getElementById('diag-med').value,
        dosage: document.getElementById('diag-dosage').value,
        instructions: document.getElementById('diag-inst').value
    };

    try {
        const res = await fetch(`${API_BASE}/appointments/${appId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        if (res.ok) {
            showToast('Completed', 'Prescription written and consultation archived.', 'success');
            document.getElementById('diagnose-modal').classList.add('hidden');
            loadTabContent(activeTab);
        } else {
            showToast('Error', 'Failed to file prescription.', 'error');
        }
    } catch (err) { console.error(err); }
}

async function handleAdminBedUpdate(e) {
    e.preventDefault();
    const token = localStorage.getItem('mercycare_token');
    const bedId = document.getElementById('abed-id').value;
    const body = {
        status: document.getElementById('abed-status').value,
        patientName: document.getElementById('abed-patient-name').value
    };

    try {
        const res = await fetch(`${API_BASE}/beds/${bedId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });
        
        if (res.ok) {
            showToast('Allocated', 'Bed Ward occupancy status updated.', 'success');
            document.getElementById('bed-modal').classList.add('hidden');
            loadTabContent(activeTab);
        } else {
            showToast('Error', 'Failed to modify bed details.', 'error');
        }
    } catch (err) { console.error(err); }
}

async function handleDoctorSave(e) {
    e.preventDefault();
    const token = localStorage.getItem('mercycare_token');
    const id = document.getElementById('adoc-id').value;
    
    const body = {
        name: document.getElementById('adoc-name').value,
        email: document.getElementById('adoc-email').value,
        specialization: document.getElementById('adoc-special').value,
        experience: document.getElementById('adoc-exp').value,
        schedule: document.getElementById('adoc-schedule').value,
        bio: document.getElementById('adoc-bio').value,
        imageUrl: document.getElementById('adoc-image').value
    };

    let url = `${API_BASE}/doctors`;
    let method = 'POST';

    if (id) {
        url = `${API_BASE}/doctors/${id}`;
        method = 'PUT';
    } else {
        body.password = document.getElementById('adoc-password').value;
    }

    try {
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        const data = await res.json();
        if (res.ok) {
            showToast('Saved', id ? 'Doctor profile updated.' : 'New doctor specialist created successfully.', 'success');
            loadAdminDoctorsTab();
            loadPublicDoctors(); // Refresh landing list
        } else {
            showToast('Error', data.error || 'Failed to save doctor details.', 'error');
        }
    } catch (err) { console.error(err); }
}

async function handleAdminBillGenerate(e) {
    e.preventDefault();
    const token = localStorage.getItem('mercycare_token');
    const body = {
        patientId: document.getElementById('abill-patient').value,
        amount: parseFloat(document.getElementById('abill-amount').value),
        description: document.getElementById('abill-desc').value,
        dueDate: document.getElementById('abill-due').value
    };

    try {
        const res = await fetch(`${API_BASE}/billing`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        if (res.ok) {
            showToast('Invoice Issued', 'Invoice successfully generated and sent to patient dashboard.', 'success');
            document.getElementById('admin-billing-form').reset();
            loadAdminBillingTab();
        } else {
            showToast('Error', 'Failed to generate invoice.', 'error');
        }
    } catch (err) { console.error(err); }
}

// ====================================================
// TOAST NOTIFICATIONS UTILITY
// ====================================================
let toastTimer = null;

function showToast(title, body, type = 'success') {
    const toast = document.getElementById('toast-notification');
    const icon = document.getElementById('toast-icon');
    const titleEl = document.getElementById('toast-title');
    const bodyEl = document.getElementById('toast-text');

    if (!toast) return;

    if (toastTimer) clearTimeout(toastTimer);

    // Apply colors/icons
    toast.className = 'toast'; // reset
    if (type === 'error') {
        toast.classList.add('toast-error');
        icon.className = 'fa-solid fa-circle-xmark toast-icon-error';
    } else {
        icon.className = 'fa-solid fa-circle-check toast-icon-success';
    }

    titleEl.innerText = title;
    bodyEl.innerText = body;

    toast.classList.remove('hidden');

    // Auto close after 5s
    toastTimer = setTimeout(() => {
        toast.classList.add('hidden');
    }, 5000);
}
