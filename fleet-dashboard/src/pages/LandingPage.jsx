import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import '../styles/landing.css';

function LandingPage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const { showToast } = useToast();
  const [showAuthModal, setShowAuthModal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    name: '',
    company: ''
  });

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let result;

      if (showAuthModal === 'login') {
        result = await login(authForm.email, authForm.password);
      } else {
        result = await register(authForm.email, authForm.password, authForm.name, authForm.company);
      }

      if (result.ok) {
        showToast(
          showAuthModal === 'login' ? 'Prisijungę sėkmingai!' : 'Registracija sėkminga!',
          'success'
        );
        closeModal();
        navigate('/dashboard');
      } else {
        showToast(result.error || 'Klaida', 'error');
      }
    } catch (err) {
      showToast('Klaida: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setShowAuthModal(null);
    setAuthForm({ email: '', password: '', name: '', company: '' });
  };

  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="landing-nav-content">
          <div className="landing-logo">
            <div className="logo-icon">🚗</div>
            <span className="logo-text">FleetTrack</span>
          </div>

          <div className="landing-nav-links">
            <a href="#features" className="nav-link">Funkcijos</a>
            <a href="#pricing" className="nav-link">Kainos</a>
            <a href="#contact" className="nav-link">Kontaktai</a>
            <button 
              className="btn-ghost"
              onClick={() => setShowAuthModal('login')}
            >
              Prisijungti
            </button>
            <button 
              className="btn-primary"
              onClick={() => setShowAuthModal('signup')}
            >
              Pradėti nemokamai
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            Valdykite savo transporto parką
            <span className="hero-gradient"> viename sprendime</span>
          </h1>
          
          <p className="hero-subtitle">
            GPS stebėjimas realiuoju laiku, automatinės ataskaitos ir išmanus
            automobilių valdymas. Pradėkite nemokamai per 2 minutes.
          </p>

          <div className="hero-cta">
            <button 
              className="btn-hero-primary"
              onClick={() => setShowAuthModal('signup')}
            >
              Registruotis nemokamai
            </button>
            <button className="btn-hero-secondary">
              Žiūrėti demo
            </button>
          </div>

          <div className="hero-stats">
            <div className="stat-item">
              <div className="stat-number">500+</div>
              <div className="stat-label">Įmonių</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">5,000+</div>
              <div className="stat-label">Automobilių</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">99.9%</div>
              <div className="stat-label">Veikimo laikas</div>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="dashboard-preview">
            <div className="preview-header">
              <div className="preview-dots">
                <span></span><span></span><span></span>
              </div>
            </div>
            <div className="preview-content">
              <div className="preview-sidebar"></div>
              <div className="preview-main">
                <div className="preview-card"></div>
                <div className="preview-card"></div>
                <div className="preview-map">📍</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <h2 className="section-title">Visos funkcijos vienoje platformoje</h2>
        <p className="section-subtitle">
          Profesionalus transporto valdymas, prieinamas kiekvienam
        </p>

        <div className="features-grid">
          {[
            { icon: '📍', title: 'GPS stebėjimas realiuoju laiku', desc: 'Matykite visus automobilius žemėlapyje, sekite jų maršrutus ir gaukite pranešimus' },
            { icon: '📊', title: 'Automatinės ataskaitos', desc: 'Detali apskaita apie nuvažiuotus kilometrus, kuro sąnaudas ir vairuotojų elgesį' },
            { icon: '🔧', title: 'Serviso valdymas', desc: 'Planuokite techninę priežiūrą, gaukite priminimus ir valdykite visus dokumentus' },
            { icon: '📱', title: 'Mobilios programėlės', desc: 'iOS ir Android aplikacijos vairuotojams ir vadovams' },
            { icon: '⚡', title: 'FMB130 integracija', desc: 'Pilna Teltonika FMB130 įrangos parama su duomenų perdavimu realiuoju laiku' },
            { icon: '🔒', title: 'Saugumas ir privatumas', desc: 'Šifracija, duomenų apsauga ir GDPR atitiktis' }
          ].map((feature, i) => (
            <div key={i} className="feature-card">
              <div className="feature-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="pricing-section">
        <h2 className="section-title">Skaidrios kainos</h2>
        <p className="section-subtitle">Pasirinkite planą, atitinkantį jūsų poreikius</p>

        <div className="pricing-grid">
          <div className="pricing-card">
            <div className="pricing-badge">Nemokama</div>
            <h3>Starter</h3>
            <div className="pricing-price">
              <span className="price-amount">0€</span>
              <span className="price-period">/mėn</span>
            </div>
            <ul className="pricing-features">
              <li>✓ Iki 3 automobilių</li>
              <li>✓ GPS stebėjimas</li>
              <li>✓ Pagrindinės ataskaitos</li>
              <li>✓ 7 dienų istorija</li>
            </ul>
            <button 
              className="btn-pricing"
              onClick={() => setShowAuthModal('signup')}
            >
              Pradėti nemokamai
            </button>
          </div>

          <div className="pricing-card pricing-card-featured">
            <div className="pricing-badge pricing-badge-featured">Populiariausias</div>
            <h3>Professional</h3>
            <div className="pricing-price">
              <span className="price-amount">29€</span>
              <span className="price-period">/mėn</span>
            </div>
            <ul className="pricing-features">
              <li>✓ Iki 15 automobilių</li>
              <li>✓ Visos funkcijos</li>
              <li>✓ Mobilios programėlės</li>
              <li>✓ API prieiga</li>
            </ul>
            <button 
              className="btn-pricing btn-pricing-featured"
              onClick={() => setShowAuthModal('signup')}
            >
              Pradėti 14 dienų trial
            </button>
          </div>

          <div className="pricing-card">
            <div className="pricing-badge">Įmonėms</div>
            <h3>Enterprise</h3>
            <div className="pricing-price">
              <span className="price-amount">Individuali</span>
            </div>
            <ul className="pricing-features">
              <li>✓ Neriboti automobiliai</li>
              <li>✓ Dedikuotas serveris</li>
              <li>✓ SLA garantija</li>
              <li>✓ Prioritetinė pagalba</li>
            </ul>
            <button className="btn-pricing">
              Susisiekti
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-section">
            <div className="footer-logo">
              <div className="logo-icon">🚗</div>
              <span className="logo-text">FleetTrack</span>
            </div>
            <p className="footer-desc">
              Profesionalus transporto valdymo sprendimas Lietuvos įmonėms
            </p>
          </div>

          <div className="footer-section">
            <h4>Produktas</h4>
            <a href="#features">Funkcijos</a>
            <a href="#pricing">Kainos</a>
            <a href="/docs">Dokumentacija</a>
          </div>

          <div className="footer-section">
            <h4>Įmonė</h4>
            <a href="#about">Apie mus</a>
            <a href="#contact">Kontaktai</a>
            <a href="/blog">Naujienos</a>
          </div>

          <div className="footer-section">
            <h4>Teisė</h4>
            <a href="/terms" target="_blank" rel="noopener noreferrer">Naudojimo sąlygos</a>
            <a href="/privacy" target="_blank" rel="noopener noreferrer">Privatumo politika</a>
            <a href="/cookies">Slapukai</a>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© 2025 FleetTrack. Visos teisės saugomos.</p>
        </div>
      </footer>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="auth-modal-overlay" onClick={closeModal}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <button className="auth-modal-close" onClick={closeModal}>×</button>
            
            <h2 className="auth-modal-title">
              {showAuthModal === 'login' ? 'Prisijungti' : 'Registruotis'}
            </h2>

            <div className="auth-form">
              {showAuthModal === 'signup' && (
                <>
                  <div className="form-group">
                    <label>Vardas Pavardė</label>
                    <input
                      type="text"
                      value={authForm.name}
                      onChange={(e) => setAuthForm({...authForm, name: e.target.value})}
                      placeholder="Jonas Jonaitis"
                      disabled={loading}
                    />
                  </div>

                  <div className="form-group">
                    <label>Įmonė</label>
                    <input
                      type="text"
                      value={authForm.company}
                      onChange={(e) => setAuthForm({...authForm, company: e.target.value})}
                      placeholder="UAB Pavyzdys"
                      disabled={loading}
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label>El. paštas</label>
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                  placeholder="jusu@email.lt"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label>Slaptažodis</label>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                  placeholder="••••••••"
                  disabled={loading}
                />
              </div>

              {showAuthModal === 'signup' && (
                <div className="form-group-checkbox">
                  <input type="checkbox" id="terms" />
                  <label htmlFor="terms">
                    Sutinku su{' '}
                    <a href="/terms" target="_blank" rel="noopener noreferrer">
                      naudojimo sąlygomis
                    </a>
                    {' '}ir{' '}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer">
                      privatumo politika
                    </a>
                  </label>
                </div>
              )}

              <button 
                onClick={handleAuth} 
                className="btn-auth-submit"
                disabled={loading}
              >
                {loading ? 'Kraunama...' : (showAuthModal === 'login' ? 'Prisijungti' : 'Sukurti paskyrą')}
              </button>
            </div>

            <div className="auth-modal-footer">
              {showAuthModal === 'login' ? (
                <>
                  Neturite paskyros?{' '}
                  <button 
                    className="auth-link"
                    onClick={() => setShowAuthModal('signup')}
                  >
                    Registruotis
                  </button>
                </>
              ) : (
                <>
                  Jau turite paskyrą?{' '}
                  <button 
                    className="auth-link"
                    onClick={() => setShowAuthModal('login')}
                  >
                    Prisijungti
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LandingPage;
