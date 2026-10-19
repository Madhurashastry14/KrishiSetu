import React from "react";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight, ArrowUpRight, BarChart3, Bell, Check, CircleHelp,
  ClipboardList, Clock3, Leaf, LogOut, Menu, Mic, Plus, Search, Settings2, ShieldCheck, ShoppingBag,
  Sprout, Store, X
} from "lucide-react";
import { api, imageUrl } from "./api.js";
import { useAuth } from "./AuthContext.jsx";
import { useLanguage } from "./i18n.jsx";

const PriceInsights = lazy(() => import("./PriceInsights.jsx"));
const units = ["kg", "quintal", "piece", "dozen", "bunch"];
const districts = ["Dakshina Kannada", "Udupi"];
const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const prettyDate = (value) => new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const rolePath = (user) => user?.role === "FARMER" ? "/dashboard" : "/dashboard";
const statusText = (status, t) => ({
  PENDING: t("statusPending"),
  ACCEPTED: t("statusAccepted"),
  DECLINED: t("statusDeclined"),
  WITHDRAWN: t("offerWithdrawn")
}[status] || status);

function Button({ children, variant = "primary", icon: Icon, className = "", ...props }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{Icon && <Icon size={17} strokeWidth={2} />}{children}</button>;
}

function Field({ label, hint, className = "", children, ...props }) {
  return <label className={`field ${className}`}><span>{label}</span>{children || <input {...props} />}{hint && <small>{hint}</small>}</label>;
}

function ErrorNote({ children }) {
  return children ? <div className="notice notice-error" role="alert">{children}</div> : null;
}

function EmptyState({ icon: Icon = Sprout, title, detail }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={22} /></span><h3>{title}</h3>{detail && <p>{detail}</p>}</div>;
}

function App() {
  const { user, ready, authError } = useAuth();
  const { t } = useLanguage();
  if (!ready) return <div className="page-loading" role="status"><span className="spinner" />{t("loading")}</div>;
  if (authError) return <main className="not-found"><ErrorNote>{authError}</ErrorNote><Link className="button button-secondary" to="/">{t("backHome")}</Link></main>;
  return <Routes>
    <Route path="/" element={user ? <Navigate to={rolePath(user)} replace /> : <Landing />} />
    <Route path="/login" element={user ? <Navigate to={rolePath(user)} replace /> : <AuthPage mode="login" />} />
    <Route path="/register" element={user ? <Navigate to={rolePath(user)} replace /> : <AuthPage mode="register" />} />
    <Route path="/marketplace/:id" element={<ListingDetailRoute />} />
    <Route element={<ProtectedLayout />}>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/marketplace" element={<Marketplace />} />
      <Route path="/listings" element={<ListingsPage />} />
      <Route path="/listings/new" element={<ListingForm />} />
      <Route path="/listings/:id/edit" element={<ListingForm />} />
      <Route path="/requests" element={<RequestsPage />} />
      <Route path="/requests/new" element={<RequestForm />} />
      <Route path="/requests/:id/edit" element={<RequestForm />} />
      <Route path="/prices" element={<PriceInsights />} />
      <Route path="/profile" element={<ProfilePage />} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>;
}

function LanguageSwitch() {
  const { language, changeLanguage } = useLanguage();
  return <div className="language-switch" aria-label="Language">
    <button className={language === "en" ? "selected" : ""} onClick={() => changeLanguage("en")}>EN</button>
    <button className={language === "kn" ? "selected" : ""} onClick={() => changeLanguage("kn")}>ಕನ್ನಡ</button>
  </div>;
}

function Landing() {
  const { t } = useLanguage();
  return <div className="landing">
    <header className="public-header">
      <Link to="/" className="brand"><span className="brand-mark"><Sprout size={22} /></span><span>{t("brand")}<small>{t("tagline")}</small></span></Link>
      <div className="public-actions"><LanguageSwitch /><Link className="button button-quiet" to="/login">{t("signIn")}</Link><Link className="button button-primary" to="/register">{t("join")}<ArrowRight size={16} /></Link></div>
    </header>
    <main>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-dot" /> {t("landingEyebrow")}</span>
          <h1>{t("heroTitle")}</h1>
          <p>{t("heroDescription")}</p>
          <div className="hero-actions"><Link className="button button-primary button-large" to="/register">{t("join")}<ArrowRight size={18} /></Link><Link to="/login" className="text-link">{t("heroLogin")} <ArrowRight size={15} /></Link></div>
          <div className="hero-proof"><span className="proof-icon"><ShieldCheck size={16} /></span><span>{t("heroProof")}</span></div>
        </div>
        <div className="hero-image" role="img" aria-label="Freshly harvested produce in a farmer's market">
          <div className="image-caption"><span className="caption-mark"><Leaf size={17} /></span><span><strong>Grown close. Shared fairly.</strong><small>Made for our local food community</small></span></div>
          <div className="hero-stamp"><span>ಕರಾವಳಿ</span><small>COASTAL KARNATAKA</small></div>
        </div>
      </section>
      <section className="landing-features">
        <div><span className="feature-icon"><Store size={20} /></span><h2>{t("featureBuyers")}</h2><p>{t("featureBuyerCopy")}</p></div>
        <div><span className="feature-icon"><BarChart3 size={20} /></span><h2>{t("featureReference")}</h2><p>{t("featureReferenceCopy")}</p></div>
        <div><span className="feature-icon"><ClipboardList size={20} /></span><h2>{t("featureOffers")}</h2><p>{t("featureOffersCopy")}</p></div>
      </section>
    </main>
    <footer className="public-footer"><span>© KrishiSetu · A local marketplace MVP</span><span>{t("demoDisclaimer")}</span></footer>
  </div>;
}

function ProtectedLayout({ children }) {
  const { user, ready, logout } = useAuth();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => setMenuOpen(false), [location.pathname]);
  if (!ready) return <div className="page-loading"><span className="spinner" />{t("loading")}</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  const links = [
    { to: "/dashboard", label: t("dashboard"), icon: BarChart3 },
    ...(user.role === "FARMER" ? [{ to: "/listings", label: t("listings"), icon: Sprout }] : []),
    { to: "/marketplace", label: t("marketplace"), icon: ShoppingBag },
    { to: "/requests", label: t("requests"), icon: ClipboardList },
    { to: "/prices", label: t("prices"), icon: BarChart3 }
  ];
  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
      <Link to="/dashboard" className="brand"><span className="brand-mark"><Sprout size={22} /></span><span>{t("brand")}<small>{t("tagline")}</small></span></Link>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">{links.map(({ to, label, icon: Icon }) =>
        <Link key={to} to={to} className={location.pathname === to || (to === "/requests" && location.pathname === "/requests/new") ? "active" : ""}><Icon size={18} /><span>{label}</span></Link>
      )}</nav>
      <div className="sidebar-spacer" />
      <div className="help-card"><span><CircleHelp size={17} /></span><strong>Here to help</strong><p>Need a hand getting started?</p><a href="mailto:hello@krishisetu.local">Contact our team <ArrowRight size={13} /></a></div>
      <Link to="/profile" className="side-profile"><span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><span><strong>{user.name}</strong><small>{user.role === "FARMER" ? t("farmer") : t("buyer")}</small></span><Settings2 size={17} /></Link>
    </aside>
    {menuOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <div className="main-column">
      <header className="topbar">
        <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
        <div className="breadcrumb"><span>{t("brand")}</span><span className="crumb-slash">/</span><strong>{links.find((link) => link.to === location.pathname)?.label || (location.pathname.startsWith("/listings") ? t("listings") : location.pathname.startsWith("/requests") ? t("requests") : location.pathname.startsWith("/marketplace") ? t("marketplace") : t("profile"))}</strong></div>
        <div className="topbar-actions"><span className="role-pill"><span />{user.role === "FARMER" ? t("farmer") : t("buyer")}</span><LanguageSwitch /><button className="icon-button" title={t("signOut")} onClick={async () => { setLogoutError(""); try { await logout(); navigate("/"); } catch (error) { setLogoutError(error.message); } }}><LogOut size={17} /><span>{t("signOut")}</span></button></div>
      </header>
      {logoutError && <div className="content-area"><ErrorNote>{logoutError}</ErrorNote></div>}
      <main className="content-area">{children || <RoutesContent />}</main>
    </div>
  </div>;
}

function RoutesContent() {
  const location = useLocation();
  if (location.pathname === "/prices") return <Suspense fallback={<div className="panel-loading"><span className="spinner" />Loading…</div>}><PriceInsights /></Suspense>;
  const routes = {
    "/dashboard": <Dashboard />, "/marketplace": <Marketplace />, "/listings": <ListingsPage />,
    "/listings/new": <ListingForm />, "/requests": <RequestsPage />, "/requests/new": <RequestForm />,
    "/profile": <ProfilePage />
  };
  if (location.pathname.startsWith("/marketplace/")) return <ProductDetailPage />;
  if (location.pathname.startsWith("/requests/") && location.pathname.endsWith("/edit")) return <RequestForm />;
  if (location.pathname.startsWith("/listings/") && location.pathname.endsWith("/edit")) return <ListingForm />;
  return routes[location.pathname] || <Dashboard />;
}

function ListingDetailRoute() {
  const { user } = useAuth();
  const { t } = useLanguage();
  if (user) return <ProtectedLayout><ProductDetailPage /></ProtectedLayout>;
  return <div className="listing-public-shell">
    <header className="public-header">
      <Link to="/" className="brand"><span className="brand-mark"><Sprout size={22} /></span><span>{t("brand")}<small>{t("tagline")}</small></span></Link>
      <div className="public-actions"><LanguageSwitch /><Link className="button button-quiet" to="/login">{t("signIn")}</Link><Link className="button button-primary" to="/register">{t("join")}</Link></div>
    </header>
    <main className="listing-public-content"><ProductDetailPage /></main>
  </div>;
}

function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const { login, register } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState("FARMER");
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    if (isRegister) body.shareContact = form.get("shareContact") === "on";
    setError(""); setBusy(true);
    try {
      if (isRegister) await register(body); else await login(body);
      navigate(location.state?.from || "/dashboard", { replace: true });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <div className="auth-page">
    <div className="auth-side"><Link to="/" className="brand brand-light"><span className="brand-mark"><Sprout size={22} /></span><span>{t("brand")}<small>{t("tagline")}</small></span></Link><div className="auth-quote"><span className="eyebrow">A BETTER LOCAL FOOD CHAIN</span><h1>Good things grow<br />when we connect.</h1><p>One simple place for growers and buyers to find each other.</p></div><div className="auth-side-bottom"><Leaf size={17} /> Grown in our community, for our community.</div></div>
    <section className="auth-main"><div className="auth-tools"><LanguageSwitch /><Link to="/" className="text-link">{t("home")}</Link></div>
      <form className="auth-form" onSubmit={submit}>
        <span className="eyebrow">{isRegister ? "YOUR LOCAL MARKETPLACE" : "GOOD TO SEE YOU AGAIN"}</span>
        <h2>{isRegister ? t("registration") : t("loginTitle")}</h2>
        <p className="auth-subtitle">{isRegister ? "Create a profile to start connecting." : "Sign in to continue to your workspace."}</p>
        {isRegister && <Field label={t("name")}><input name="name" required autoComplete="name" maxLength="100" /></Field>}
        <Field label={t("email")}><input type="email" name="email" required autoComplete="email" /></Field>
        <Field label={t("password")} hint={isRegister ? "Use at least 8 characters." : undefined}><input type="password" name="password" required minLength={isRegister ? 8 : 1} autoComplete={isRegister ? "new-password" : "current-password"} /></Field>
        {isRegister && <>
          <Field label={t("role")}><select name="role" value={role} onChange={(event) => setRole(event.target.value)}><option value="FARMER">{t("farmer")}</option><option value="BUYER">{t("buyer")}</option></select></Field>
          <div className="form-two"><Field label={t("village")}><input name="village" maxLength="100" /></Field><Field label={t("district")}><select name="district"><option value="">Choose district</option>{districts.map((district) => <option key={district}>{district}</option>)}</select></Field></div>
          <Field label={t("phone")}><input name="phone" type="tel" autoComplete="tel" /></Field>
          <label className="check-field"><input type="checkbox" name="shareContact" /><span>{t("shareContact")}</span></label>
        </>}
        <ErrorNote>{error}</ErrorNote>
        <Button type="submit" className="full-button" disabled={busy}>{busy ? t("loading") : isRegister ? t("join") : t("signIn")}<ArrowRight size={17} /></Button>
        <p className="auth-switch">{isRegister ? t("loginPrompt") : t("signUpPrompt")} <Link to={isRegister ? "/login" : "/register"}>{isRegister ? t("signIn") : t("join")}</Link></p>
      </form>
      <div className="auth-footnote">Your account details stay private. Contact details are shared only when you choose.</div>
    </section>
  </div>;
}

function PageHeading({ eyebrow, title, detail, action }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{detail && <p>{detail}</p>}</div>{action}</div>;
}

function Dashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api("/dashboard"));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh]);
  const farmer = user.role === "FARMER";
  return <div className="page-content">
    <PageHeading eyebrow={farmer ? "FARMER WORKSPACE" : "BUYER WORKSPACE"} title={`${t("welcome")}, ${user.name.split(" ")[0]}`} detail={farmer ? "Your harvest, current demand and next steps at a glance." : "Find local produce and keep track of what you need."} action={farmer ? <Link className="button button-primary" to="/listings/new"><Plus size={17} />{t("createListing")}</Link> : <Link className="button button-primary" to="/requests/new"><Plus size={17} />{t("createRequest")}</Link>} />
    <ErrorNote>{error}</ErrorNote>
    {loading && !data ? <div className="panel-loading" role="status"><span className="spinner" />{t("loading")}</div> : data ? <>
      <div className="stat-grid">
        {farmer ? <>
          <StatCard label={t("activeListings")} value={data.activeListings} icon={Sprout} caption="Available to nearby buyers" />
          <StatCard label={t("openRequests")} value={data.requests.length} icon={ClipboardList} caption="Local buyer opportunities" />
          <StatCard label="Your responses" value={data.recentResponses.length} icon={ArrowUpRight} caption="Offers you've sent" />
        </> : <>
          <StatCard label={t("openRequests")} value={data.openRequests} icon={ClipboardList} caption="Your active buying requests" />
          <StatCard label={t("pendingResponses")} value={data.responses} icon={Bell} caption="Offers waiting for review" />
          <StatCard label={t("marketplace")} value={data.activeListings.length} icon={ShoppingBag} caption="Recently added local produce" />
        </>}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading"><div><h2>{farmer ? "Nearby buyer requests" : "Fresh local produce"}</h2><p>{farmer ? "Recent opportunities in your area" : "Recently listed by local growers"}</p></div><Link className="inline-link" to={farmer ? "/requests" : "/marketplace"}>View all <ArrowRight size={15} /></Link></div>
          {farmer ? <RequestPreview items={data.requests} /> : <ProduceList items={data.activeListings} t={t} />}
        </section>
        <section className="panel tips-panel"><span className="feature-icon"><BarChart3 size={20} /></span><span className="eyebrow">PRICE TRANSPARENCY</span><h2>Know your reference.</h2><p>Compare an asking price with the latest available mandi observation. Each reference shows its source and date.</p><Link className="button button-secondary" to="/prices">Explore price insights<ArrowRight size={16} /></Link><div className="tip-foot"><ShieldCheck size={15} /> Indicative comparison, never a price prediction.</div></section>
      </div>
      {farmer && <section className="panel farmer-offers-panel">
        <div className="panel-heading"><div><h2>{t("myOffers")}</h2><p>{t("offerStatusHelp")}</p></div><Link className="inline-link" to="/requests">{t("requests")}<ArrowRight size={15} /></Link></div>
        {data.recentResponses.length ? <div className="farmer-offer-list">{data.recentResponses.map((offer) => <FarmerOfferSummary key={offer.id} offer={offer} t={t} />)}</div> : <EmptyState icon={ClipboardList} title={t("noOffersSent")} detail={t("noOffersSentHelp")} />}
      </section>}
      <p className="page-footnote"><span className="demo-dot" /> Demo marketplace · Historical/sample data is clearly identified.</p>
    </> : null}
  </div>;
}

export function OfferStatusBadge({ status, t }) {
  const classes = {
    PENDING: "status-amber",
    ACCEPTED: "status-green",
    DECLINED: "status-muted",
    WITHDRAWN: "status-muted"
  };
  return <span className={`status-badge ${classes[status] || "status-muted"}`}><span />{t(`offer${status[0]}${status.slice(1).toLowerCase()}`)}</span>;
}

function FarmerOfferSummary({ offer, t }) {
  return <article className="farmer-offer-row">
    <span className="crop-avatar"><Sprout size={17} /></span>
    <span className="farmer-offer-main">
      <strong>{offer.request.crop}</strong>
      <small>{t("requestFrom")} {offer.request.buyer.name} · {offer.request.district}</small>
    </span>
    <span className="farmer-offer-details">
      <strong>{offer.quantity} {offer.unit} · {money(offer.price)} / {offer.unit}</strong>
      <small>{t("buyerRequest")}: {offer.request.quantity} {offer.request.unit} · {t("offerUpdated")} {prettyDate(offer.updatedAt)}</small>
    </span>
    <OfferStatusBadge status={offer.status} t={t} />
  </article>;
}

function StatCard({ label, value, icon: Icon, caption }) {
  return <section className="stat-card"><div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon size={19} /></span></div><strong>{value ?? "—"}</strong><small>{caption}</small></section>;
}

function RequestPreview({ items = [] }) {
  const { t } = useLanguage();
  if (!items.length) return <EmptyState icon={ClipboardList} title={t("noRequests")} detail="Check back soon for new local demand." />;
  return <div className="preview-list">{items.map((item) => <div className="preview-row" key={item.id}><span className="crop-avatar">{item.crop.slice(0, 1).toUpperCase()}</span><span className="preview-main"><strong>{item.crop}</strong><small>{item.quantity} {item.unit} · {item.district}</small></span><span className="preview-date"><Clock3 size={13} />{prettyDate(item.deadline)}</span></div>)}</div>;
}

function ProduceList({ items = [], t }) {
  if (!items.length) return <EmptyState title={t("noResults")} />;
  return <div className="preview-list">{items.map((item) => <div className="preview-row" key={item.id}><span className="crop-avatar"><Sprout size={17} /></span><span className="preview-main"><strong>{item.crop}</strong><small>{item.farmer?.name} · {item.village}, {item.district}</small></span><strong className="row-price">{money(item.expectedPrice)}<small> / {item.unit}</small></strong></div>)}</div>;
}

function ListingsPage() {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  async function load() { setBusy(true); try { setItems((await api("/listings")).items); setError(""); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  useEffect(() => { load(); }, []);
  async function deactivate(item) {
    try { await api(`/listings/${item.id}`, { method: "PATCH", body: { status: "INACTIVE" } }); await load(); }
    catch (err) { setError(err.message); }
  }
  return <div className="page-content">
    <PageHeading eyebrow="YOUR FARM" title={t("listings")} detail="Keep your available produce up to date for nearby buyers." action={<Link className="button button-primary" to="/listings/new"><Plus size={17} />{t("createListing")}</Link>} />
    <ErrorNote>{error}</ErrorNote>
    {busy ? <div className="panel-loading"><span className="spinner" />{t("loading")}</div> : items.length ? <div className="listing-grid">{items.map((item) => <article className={`listing-card ${item.status === "INACTIVE" ? "listing-inactive" : ""}`} key={item.id}>
      <ProductImage item={item} /><div className="listing-card-body"><div className="listing-meta"><span className={`status-badge ${item.status === "ACTIVE" ? "status-green" : "status-muted"}`}><span />{item.status === "ACTIVE" ? t("statusActive") : t("statusInactive")}</span><span>{prettyDate(item.updatedAt)}</span></div><h3>{item.crop}</h3><p>{item.variety || item.grade || "Local harvest"} · {item.village}, {item.district}</p><div className="listing-bottom"><strong>{money(item.expectedPrice)}<small> / {item.unit}</small></strong><span>{item.quantity} {item.unit} available</span></div><FairMeter crop={item.crop} expectedPrice={item.expectedPrice} unit={item.unit} district={item.district} compact /></div>
      <div className="listing-actions"><Link className="button button-quiet" to={`/listings/${item.id}/edit`}>{t("edit")}</Link>{item.status === "ACTIVE" && <Button variant="quiet" onClick={() => deactivate(item)}>{t("deactivate")}</Button>}</div>
    </article>)}</div> : <div className="panel"><EmptyState title={t("noListings")} detail="Share what is ready to harvest and how much you have available." /></div>}
  </div>;
}

function ProductImage({ item }) {
  const [failed, setFailed] = useState(false);
  if (!item.imageUrl || failed) return <div className="product-image product-image-fallback"><span><Sprout size={25} /></span><small>{item.crop}</small></div>;
  return <img className="product-image" src={imageUrl(item.imageUrl)} alt={`${item.crop} listing`} onError={() => setFailed(true)} />;
}

function ListingForm() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const id = location.pathname.match(/\/listings\/([^/]+)\/edit/)?.[1];
  const [values, setValues] = useState({ crop: "", quantity: "", unit: "kg", expectedPrice: "", village: user.village || "", district: user.district || "Dakshina Kannada", imageUrl: "", variety: "", grade: "" });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  useEffect(() => { if (!id) return; api("/listings").then(({ items }) => {
    const item = items.find((listing) => listing.id === id);
    if (!item) throw new Error("Listing not found.");
    setValues({ ...item, quantity: String(item.quantity), expectedPrice: String(item.expectedPrice) });
    if (item.imageUrl) setImagePreview(imageUrl(item.imageUrl));
  }).catch((err) => setError(err.message)).finally(() => setLoading(false)); }, [id]);
  const set = (key) => (event) => setValues((current) => ({ ...current, [key]: event.target.value }));
  async function uploadImage(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Image must be 5 MB or smaller."); return; }
    const body = new FormData(); body.append("image", file);
    try {
      const result = await api("/uploads", { method: "POST", body });
      setValues((current) => ({ ...current, imageUrl: result.imageUrl }));
      setImagePreview(URL.createObjectURL(file));
      setError("");
    } catch (err) { setError(err.message); }
  }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    try {
      await api(id ? `/listings/${id}` : "/listings", { method: id ? "PATCH" : "POST", body: values });
      setSuccess(t("listingSaved"));
      window.setTimeout(() => navigate("/listings"), 450);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  if (loading) return <div className="panel-loading"><span className="spinner" />{t("loading")}</div>;
  return <div className="page-content narrow-content">
    <PageHeading eyebrow="FARMER WORKSPACE" title={id ? `${t("edit")} ${values.crop}` : t("createListing")} detail="A few clear details help buyers understand your harvest." />
    <form className="form-panel" onSubmit={submit}>
      <div className="form-section-title"><span>01</span><div><h2>Produce details</h2><p>Start with what you have available.</p></div></div>
      <div className="form-grid">
        <div className="voice-field"><Field label={t("crop")}><input value={values.crop} onChange={set("crop")} required maxLength="100" autoComplete="off" /></Field><VoiceButton onResult={(value) => setValues((current) => ({ ...current, crop: value }))} /></div>
        <div className="form-two"><Field label={t("quantity")}><input value={values.quantity} onChange={set("quantity")} type="number" min="0.01" step="0.01" required /></Field><Field label={t("unit")}><select value={values.unit} onChange={set("unit")}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></Field></div>
        <div className="form-two"><Field label={t("expectedPrice")}><input value={values.expectedPrice} onChange={set("expectedPrice")} type="number" min="0.01" step="0.01" required /></Field><Field label={t("village")}><input value={values.village} onChange={set("village")} required maxLength="100" /></Field></div>
        <Field label={t("district")}><select value={values.district} onChange={set("district")} required>{districts.map((district) => <option key={district}>{district}</option>)}</select></Field>
        <div className="form-two"><Field label={t("variety")}><input value={values.variety || ""} onChange={set("variety")} maxLength="100" /></Field><Field label={t("grade")}><input value={values.grade || ""} onChange={set("grade")} maxLength="100" /></Field></div>
        <Field label={t("image")} hint={t("imageHint")}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => uploadImage(event.target.files?.[0])} /></Field>
        {imagePreview && <img className="upload-preview" src={imagePreview} alt="Selected produce preview" />}
      </div>
      <div className="meter-check"><div className="meter-title"><span className="meter-icon"><BarChart3 size={18} /></span><div><h3>{t("fairPrice")}</h3><p>{t("compareNote")}</p></div></div><FairMeter crop={values.crop} expectedPrice={values.expectedPrice} unit={values.unit} district={values.district} /></div>
      <ErrorNote>{error}</ErrorNote>{success && <div className="notice notice-success"><Check size={16} />{success}</div>}
      <div className="form-actions"><Link className="button button-quiet" to="/listings">{t("cancel")}</Link><Button type="submit" disabled={busy}>{busy ? t("loading") : t("save")}<ArrowRight size={16} /></Button></div>
    </form>
  </div>;
}

function VoiceButton({ onResult }) {
  const { t, language } = useLanguage();
  const [message, setMessage] = useState("");
  const [listening, setListening] = useState(false);
  function start() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { setMessage(t("voiceUnsupported")); return; }
    const recognition = new Recognition();
    recognition.lang = language === "kn" ? "kn-IN" : "en-IN";
    recognition.onresult = (event) => { onResult(event.results[0][0].transcript); setMessage(""); };
    recognition.onerror = (event) => setMessage(event.error === "not-allowed" ? t("voiceDenied") : t("voiceUnsupported"));
    recognition.onend = () => setListening(false);
    try { setListening(true); recognition.start(); } catch { setListening(false); setMessage(t("voiceUnsupported")); }
  }
  return <div className="voice-control"><button type="button" className="voice-button" onClick={start} aria-label={t("voice")} title={t("voice")}><Mic size={18} />{listening ? "Listening…" : t("voice")}</button>{message && <small role="status">{message}</small>}</div>;
}

function FairMeter({ crop, expectedPrice, unit, district, compact = false }) {
  const { t } = useLanguage();
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!crop || Number(expectedPrice) <= 0 || !unit) { setResult(null); return; }
    let active = true;
    const timer = window.setTimeout(() => api(`/prices/compare?${new URLSearchParams({ crop, expectedPrice, unit, district: district || "" })}`).then((data) => {
      if (active) { setResult(data); setError(""); }
    }).catch((err) => { if (active) setError(err.message); }), 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [crop, expectedPrice, unit, district]);
  if (error) return <p className="meter-muted" role="status">{error}</p>;
  if (!result) return <p className="meter-muted">{t("noPrice")}</p>;
  if (!result.available) return <p className="meter-muted">{t("noPrice")}</p>;
  return <div className={`fair-result ${compact ? "fair-compact" : ""}`}>
    <div className={`fair-band fair-${result.band.toLowerCase()}`}><span className="band-dot" /><strong>{t(result.band === "GREEN" ? "bandGreen" : result.band === "AMBER" ? "bandAmber" : "bandRed")}</strong></div>
    <div className="fair-reference"><span>{result.reference.market} · {prettyDate(result.reference.observedAt)}</span><strong>{money(result.reference.modalPrice)} / {result.reference.unit}</strong><small>{result.reference.source} · {result.reference.dataType === "DEMO" ? t("sampleData") : result.reference.dataType}</small></div>
    {!compact && <p className="meter-note">{result.message} {t("compareNote")}</p>}
  </div>;
}

function Marketplace() {
  const { t } = useLanguage();
  const [filters, setFilters] = useState({ q: "", district: "", village: "", minPrice: "", maxPrice: "", sort: "newest" });
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load(page = 1) {
    setLoading(true);
    const query = new URLSearchParams(Object.entries({ ...filters, page }).filter(([, value]) => value !== ""));
    try { const result = await api(`/listings/marketplace?${query}`); setItems(result.items); setPagination(result.pagination); setError(""); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  function update(key, value) { setFilters((current) => ({ ...current, [key]: value })); }
  return <div className="page-content">
    <PageHeading eyebrow="LOCAL MARKET" title={t("produceTitle")} detail="Browse fresh produce shared directly by growers around you." />
    <form className="filter-bar" onSubmit={(event) => { event.preventDefault(); load(); }}>
      <label className="search-field"><Search size={17} /><input aria-label={t("search")} placeholder={t("search")} value={filters.q} onChange={(event) => update("q", event.target.value)} /></label>
      <select aria-label={t("filterDistrict")} value={filters.district} onChange={(event) => update("district", event.target.value)}><option value="">{t("allDistricts")}</option>{districts.map((district) => <option key={district}>{district}</option>)}</select>
      <input aria-label={t("villageFilter")} placeholder={t("villageFilter")} value={filters.village} onChange={(event) => update("village", event.target.value)} />
      <input aria-label={t("minPrice")} type="number" min="0" placeholder={t("minPrice")} value={filters.minPrice} onChange={(event) => update("minPrice", event.target.value)} />
      <input aria-label={t("maxPrice")} type="number" min="0" placeholder={t("maxPrice")} value={filters.maxPrice} onChange={(event) => update("maxPrice", event.target.value)} />
      <select aria-label={t("sort")} value={filters.sort} onChange={(event) => update("sort", event.target.value)}><option value="newest">{t("newest")}</option><option value="price_asc">{t("lowToHigh")}</option><option value="price_desc">{t("highToLow")}</option></select>
      <Button type="submit" icon={Search}>{t("filter")}</Button>
    </form>
    <ErrorNote>{error}</ErrorNote>
    {loading ? <div className="panel-loading"><span className="spinner" />{t("loading")}</div> : items.length ? <>
      <div className="result-bar"><span>{pagination.total} local listing{pagination.total === 1 ? "" : "s"}</span><span>Only active produce is shown</span></div>
      <div className="market-grid">{items.map((item) => <MarketCard item={item} key={item.id} />)}</div>
      {pagination.pages > 1 && <div className="pagination"><Button variant="secondary" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>{t("previous")}</Button><span>Page {pagination.page} of {pagination.pages}</span><Button variant="secondary" disabled={pagination.page >= pagination.pages} onClick={() => load(pagination.page + 1)}>{t("next")}</Button></div>}
    </> : <div className="panel"><EmptyState icon={Search} title={t("noResults")} detail="Try a different crop or widen your location filters." /></div>}
  </div>;
}

function MarketCard({ item }) {
  const { t } = useLanguage();
  const phone = item.farmer.shareContact ? item.farmer.phone : null;
  return <article className="market-card">
    <ProductImage item={item} />
    <div className="market-card-body"><div className="market-location"><span className="status-badge status-green"><span />{t("available")}</span><span>{item.village}, {item.district}</span></div>
      <h2><Link className="product-detail-link" to={`/marketplace/${item.id}`}>{item.crop}<ArrowUpRight size={15} /></Link></h2><p>{[item.variety, item.grade].filter(Boolean).join(" · ") || "Fresh local harvest"}</p>
      <div className="market-price"><strong>{money(item.expectedPrice)}<small> / {item.unit}</small></strong><span>{item.quantity} {item.unit} available</span></div>
      <div className="seller-row"><span className="avatar avatar-small">{item.farmer.name.slice(0, 1)}</span><span><strong>{item.farmer.name}</strong><small>Local grower</small></span></div>
      {phone ? <div className="contact-actions"><a href={`tel:${phone}`} className="button button-secondary">{t("contact")}</a><a href={`https://wa.me/${phone.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer" className="whatsapp-link">WhatsApp <ArrowUpRight size={14} /></a></div> : <p className="privacy-hint"><ShieldCheck size={14} />{t("noPhone")}</p>}
      <small className="listing-date">Listed {prettyDate(item.createdAt)}</small>
    </div>
  </article>;
}

function ProductDetailPage() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const id = pathname.split("/").filter(Boolean).at(-1);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [purchaseRequest, setPurchaseRequest] = useState(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    api(`/listings/marketplace/${encodeURIComponent(id)}`).then(({ item: listing }) => {
      if (active) setItem(listing);
    }).catch((err) => {
      if (active) setError(err.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [id]);
  useEffect(() => {
    if (!item || user?.role !== "BUYER") return;
    let active = true;
    setRequestLoading(true);
    api("/requests").then(({ items }) => {
      if (active) setPurchaseRequest(items.find((entry) => entry.listingId === item.id) || null);
    }).catch((err) => {
      if (active) setRequestError(err.message);
    }).finally(() => {
      if (active) setRequestLoading(false);
    });
    return () => { active = false; };
  }, [item, user?.id, user?.role]);
  async function submitPurchaseRequest(event) {
    event.preventDefault();
    if (submitting || !item) return;
    setSubmitting(true);
    setRequestError("");
    const form = new FormData(event.currentTarget);
    const body = {
      quantityKg: Number(form.get("quantityKg")),
      pricePerKg: Number(form.get("pricePerKg")),
      message: form.get("message")
    };
    try {
      const { item: created } = await api(`/listings/marketplace/${encodeURIComponent(item.id)}/purchase-requests`, {
        method: "POST",
        body
      });
      setPurchaseRequest(created);
      setDialogOpen(false);
    } catch (err) {
      setRequestError(err.message);
    } finally {
      setSubmitting(false);
    }
  }
  if (loading) return <div className="panel-loading"><span className="spinner" />{t("loading")}</div>;
  if (error || !item) return <div className="page-content"><ErrorNote>{error || t("noResults")}</ErrorNote><Link className="button button-secondary" to="/marketplace">{t("marketplace")}</Link></div>;
  const phone = item.farmer.shareContact ? item.farmer.phone : null;
  const unit = item.unit.toLowerCase();
  const kgFactor = unit === "quintal" ? 100 : 1;
  const supportsKgRequest = unit === "kg" || unit === "quintal";
  const availableKg = Number(item.quantity) * kgFactor;
  const pricePerKg = Number(item.expectedPrice) / kgFactor;
  const listingActive = item.status === "ACTIVE" && Number(item.quantity) > 0;
  const buyerCanRequest = user?.role === "BUYER" && listingActive && supportsKgRequest;
  const acceptedResponse = purchaseRequest?.responses?.find((response) => response.status === "ACCEPTED");
  const pendingResponse = purchaseRequest?.responses?.find((response) => response.status === "PENDING");
  const declinedResponse = purchaseRequest?.responses?.find((response) => response.status === "DECLINED");
  const requestBadge = acceptedResponse ? "ACCEPTED"
    : pendingResponse ? "PENDING"
      : declinedResponse ? "DECLINED"
        : purchaseRequest?.status === "OPEN" ? "PENDING" : null;
  return <div className="page-content detail-page">
    <Link className="back-link" to={user ? "/marketplace" : "/"}>← {t("marketplace")}</Link>
    <div className="detail-layout"><div className="detail-image-wrap"><ProductImage item={item} /></div><section className="detail-summary">
      <span className={`status-badge ${listingActive ? "status-green" : "status-muted"}`}><span />{listingActive ? t("statusActive") : t("statusInactive")}</span>
      <h1>{item.crop}</h1><p>{[item.variety, item.grade].filter(Boolean).join(" · ") || t("freshHarvest")}</p>
      <strong className="detail-price">{money(supportsKgRequest ? pricePerKg : item.expectedPrice)}<small> / {supportsKgRequest ? "kg" : item.unit}</small></strong>
      <div className="detail-facts"><div><small>{t("availableQuantity")}</small><strong>{item.quantity} {item.unit}{supportsKgRequest && unit === "quintal" ? ` · ${availableKg} kg` : ""}</strong></div><div><small>{t("harvestLocation")}</small><strong>{[item.village, item.district].filter(Boolean).join(", ")}</strong></div><div><small>{t("listingDate")}</small><strong>{prettyDate(item.createdAt)}</strong></div></div>
      <div className="detail-seller"><span className="avatar">{item.farmer.name.slice(0, 1)}</span><span><strong>{item.farmer.name}</strong><small>{item.farmer.shareContact && phone ? t("contactShared") : t("contactNotShared")}</small></span></div>
      {phone ? <div className="contact-actions detail-contact"><a href={`tel:${phone}`} className="button button-secondary">{t("contactFarmer")}</a><a href={`https://wa.me/${phone.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer" className="whatsapp-link">WhatsApp <ArrowUpRight size={14} /></a></div> : <p className="privacy-hint"><ShieldCheck size={14} />{item.farmer.shareContact ? t("noContactNumber") : t("noPhone")}</p>}
      {requestLoading && <p className="request-state" role="status"><span className="spinner" />{t("checkingRequest")}</p>}
      {requestError && !requestLoading && <ErrorNote>{requestError}</ErrorNote>}
      {purchaseRequest && <section className="purchase-request-state" aria-live="polite">
        <div className="request-state-heading"><strong>{t("purchaseRequest")}</strong>{requestBadge ? <OfferStatusBadge status={requestBadge} t={t} /> : <span className="status-badge status-muted"><span />{t("statusClosed")}</span>}</div>
        <p>{t("requestedQuantity")}: {purchaseRequest.quantity} {purchaseRequest.unit} · {t("proposedPrice")}: {money(purchaseRequest.targetPrice)} / {purchaseRequest.unit}</p>
        <p>{t("deadline")}: {prettyDate(purchaseRequest.deadline)}</p>
        {purchaseRequest.requirements && <p>{purchaseRequest.requirements}</p>}
        {purchaseRequest.responses?.length ? <div className="purchase-response-list">{purchaseRequest.responses.map((response) => <p key={response.id}><strong>{response.farmer.name}</strong> · {response.quantity} {response.unit} at {money(response.price)} / {response.unit} · {statusText(response.status, t)}</p>)}</div> : <p>{t("requestPending")}</p>}
        <Link className="inline-link" to="/requests">{t("viewRequestDetails")}<ArrowRight size={15} /></Link>
      </section>}
      {buyerCanRequest && !purchaseRequest && !requestLoading && <div className="purchase-action">
        <Button className="purchase-primary" icon={ArrowUpRight} onClick={() => { setRequestError(""); setDialogOpen(true); }}>{t("sendPurchaseRequest")}</Button>
      </div>}
      {!user && listingActive && supportsKgRequest && <div className="purchase-action"><Link className="button button-primary purchase-primary" to="/login" state={{ from: pathname }}>{t("signInToRequest")}</Link></div>}
      {user?.role === "FARMER" && <p className="privacy-hint">{t("buyerOnlyPurchaseRequest")}</p>}
      {!listingActive && <p className="privacy-hint"><ShieldCheck size={14} />{t("listingUnavailable")}</p>}
      {listingActive && !supportsKgRequest && <p className="privacy-hint">{t("kgRequestsOnly")}</p>}
      {dialogOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) setDialogOpen(false); }}>
        <section className="purchase-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-modal-title">
          <div className="panel-heading"><div><h2 id="purchase-modal-title">{t("sendPurchaseRequest")}</h2><p>{item.crop} · {t("available")}: {availableKg} kg · {t("purchaseRequestDeadline")}</p></div><button type="button" className="icon-button" aria-label={t("cancel")} disabled={submitting} onClick={() => setDialogOpen(false)}><X size={17} /></button></div>
          <form className="purchase-form" onSubmit={submitPurchaseRequest}>
            <Field label={t("quantityKg")}><input name="quantityKg" type="number" min="0.01" max={availableKg} step="0.01" required autoFocus /></Field>
            <Field label={t("proposedPriceKg")}><input name="pricePerKg" type="number" min="0.01" step="0.01" defaultValue={pricePerKg.toFixed(2)} required /></Field>
            <Field label={t("messageOptional")}><textarea name="message" rows="3" maxLength="500" /></Field>
            <ErrorNote>{requestError}</ErrorNote>
            <div className="form-actions"><Button type="button" variant="quiet" disabled={submitting} onClick={() => setDialogOpen(false)}>{t("cancel")}</Button><Button disabled={submitting}>{submitting ? t("submitting") : t("submitRequest")}</Button></div>
          </form>
        </section>
      </div>}
      <FairMeter crop={item.crop} expectedPrice={item.expectedPrice} unit={item.unit} district={item.district} />
    </section></div>
  </div>;
}

function RequestsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ q: "", district: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function load() {
    setLoading(true);
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    try { setItems((await api(`/requests?${query}`)).items); setError(""); } catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  async function close(item, status) {
    setNotice("");
    try {
      await api(`/requests/${item.id}`, { method: "PATCH", body: { status } });
      setNotice(status === "CLOSED" ? t("requestClosedNotice") : t("requestReopenedNotice"));
      await load();
    }
    catch (err) { setError(err.message); }
  }
  async function updateResponse(response, status) {
    setNotice("");
    try {
      await api(`/requests/responses/${response.id}`, { method: "PATCH", body: { status } });
      setNotice(status === "ACCEPTED" ? t("offerAcceptedNotice") : t("offerDeclinedNotice"));
      await load();
    }
    catch (err) { setError(err.message); }
  }
  return <div className="page-content">
    <PageHeading eyebrow={user.role === "FARMER" ? "GROWER OPPORTUNITIES" : "YOUR BUYING BOARD"} title={user.role === "FARMER" ? t("requestsTitle") : t("requests")} detail={user.role === "FARMER" ? "Find local demand and send a clear offer directly." : "Manage your requirements and review farmer responses."} action={user.role === "BUYER" ? <Link className="button button-primary" to="/requests/new"><Plus size={17} />{t("createRequest")}</Link> : null} />
    {user.role === "FARMER" && <form className="filter-bar compact-filter" onSubmit={(event) => { event.preventDefault(); load(); }}><label className="search-field"><Search size={17} /><input placeholder={t("searchCrop")} value={filters.q} onChange={(event) => setFilters((old) => ({ ...old, q: event.target.value }))} /></label><select aria-label={t("filterDistrict")} value={filters.district} onChange={(event) => setFilters((old) => ({ ...old, district: event.target.value }))}><option value="">{t("allDistricts")}</option>{districts.map((d) => <option key={d}>{d}</option>)}</select><Button type="submit" variant="secondary" icon={Search}>{t("filter")}</Button></form>}
    <ErrorNote>{error}</ErrorNote>{notice && <div className="notice notice-success" role="status"><Check size={16} />{notice}</div>}
    {loading ? <div className="panel-loading"><span className="spinner" />{t("loading")}</div> : items.length ? <div className="request-list">{items.map((item) => user.role === "FARMER" ? <FarmerRequestCard key={item.id} item={item} onRefresh={load} /> : <BuyerRequestCard key={item.id} item={item} onStatus={close} onResponseStatus={updateResponse} />)}</div> : <div className="panel"><EmptyState icon={ClipboardList} title={t("noRequests")} detail={user.role === "BUYER" ? "Post a request to let nearby farmers know what you need." : "New buyer requests for your selected area will appear here."} /></div>}
  </div>;
}

function FarmerRequestCard({ item, onRefresh }) {
  const { t } = useLanguage();
  const existingOffer = item.responses?.[0] || null;
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      if (existingOffer) {
        await api(`/requests/responses/${existingOffer.id}`, { method: "PATCH", body });
      } else {
        await api(`/requests/${item.id}/responses`, { method: "POST", body });
      }
      setEditing(false);
      await onRefresh();
    }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function withdraw() {
    setBusy(true); setError("");
    try {
      await api(`/requests/responses/${existingOffer.id}`, { method: "PATCH", body: { status: "WITHDRAWN" } });
      await onRefresh();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  const locked = existingOffer?.status === "ACCEPTED";
  return <article className="request-card"><div className="request-card-top"><div><span className="eyebrow">BUYER REQUEST</span><h2>{item.crop}</h2></div><span className="status-badge status-green"><span />{t("statusOpen")}</span></div>
    <div className="request-facts"><span><strong>{item.quantity} {item.unit}</strong> wanted</span><span><strong>{item.targetPrice ? `${money(item.targetPrice)} / ${item.unit}` : "Open to offers"}</strong></span><span><strong>{item.district}</strong>{item.village ? ` · ${item.village}` : ""}</span><span><Clock3 size={14} />{t("deadline")} {prettyDate(item.deadline)}</span></div>
    {item.requirements && <p className="request-requirement">{item.requirements}</p>}
    <div className="request-card-bottom"><span>Posted by {item.buyer.name}{item.buyer.phone ? ` · ${item.buyer.phone}` : ""}</span>
      {existingOffer ? <span className="request-offer-label"><OfferStatusBadge status={existingOffer.status} t={t} /></span> : <Button onClick={() => setEditing(true)} icon={ArrowUpRight}>{t("respond")}</Button>}
    </div>
    {existingOffer && !editing && <div className="existing-offer">
      <div><span className="eyebrow">{t("yourOffer")}</span><strong>{existingOffer.quantity} {existingOffer.unit} · {money(existingOffer.price)} / {existingOffer.unit}</strong><small>{existingOffer.message || "—"}</small></div>
      {locked ? <span className="accepted-lock-note"><Check size={15} />{t("acceptedOfferDetails")}</span> : <div className="existing-offer-actions">
        <Button variant="secondary" disabled={busy} onClick={() => setEditing(true)}>{t("editOffer")}</Button>
        <Button variant="quiet" disabled={busy} onClick={withdraw}>{busy ? t("loading") : t("withdrawOffer")}</Button>
      </div>}
    </div>}
    {editing && <form className="response-form" onSubmit={submit}>
      <input type="hidden" name="unit" value={item.unit} />
      <div className="form-two"><Field label={t("quantity")}><input name="quantity" type="number" min="0.01" step="0.01" defaultValue={existingOffer?.quantity ?? ""} required /></Field><Field label={`${t("price")} (${item.unit})`}><input name="price" type="number" min="0.01" step="0.01" defaultValue={existingOffer?.price ?? ""} required /></Field></div>
      <Field label="Message (optional)"><input name="message" maxLength="500" defaultValue={existingOffer?.message || ""} placeholder="Add a note for the buyer" /></Field>
      <ErrorNote>{error}</ErrorNote><div className="form-actions"><Button type="button" variant="quiet" disabled={busy} onClick={() => { setEditing(false); setError(""); }}>{t("cancel")}</Button><Button disabled={busy}>{busy ? t("loading") : existingOffer ? t("updateOffer") : t("respond")}</Button></div>
    </form>}
    {!existingOffer && error && <ErrorNote>{error}</ErrorNote>}
  </article>;
}

function BuyerRequestCard({ item, onStatus, onResponseStatus }) {
  const { t } = useLanguage();
  return <article className="request-card buyer-request-card"><div className="request-card-top"><div><span className="eyebrow">YOUR REQUEST</span><h2>{item.crop}</h2></div><span className={`status-badge ${item.status === "OPEN" ? "status-green" : "status-muted"}`}><span />{item.status === "OPEN" ? t("statusOpen") : t("statusClosed")}</span></div>
    <div className="request-facts"><span><strong>{item.quantity} {item.unit}</strong> wanted</span><span><strong>{item.targetPrice ? `${money(item.targetPrice)} / ${item.unit}` : "Open to offers"}</strong></span><span><strong>{item.district}</strong></span><span><Clock3 size={14} />{t("deadline")} {prettyDate(item.deadline)}</span></div>
    {item.requirements && <p className="request-requirement">{item.requirements}</p>}
    <div className="responses-heading"><strong>Farmer responses</strong><span>{item.responses.length}</span></div>
    {item.responses.length ? <div className="response-list">{item.responses.map((response) => <div className="response-row" key={response.id}><div className="response-person"><span className="avatar avatar-small">{response.farmer.name.slice(0, 1)}</span><span><strong>{response.farmer.name}</strong><small>{response.farmer.village || "Local grower"}{response.farmer.phone ? ` · ${response.farmer.phone}` : ""}</small></span></div><div className="response-offer"><strong>{response.quantity} {response.unit} · {money(response.price)}</strong><small>{response.message || statusText(response.status, t)}</small></div><span className={`status-badge ${response.status === "PENDING" ? "status-amber" : response.status === "ACCEPTED" ? "status-green" : "status-muted"}`}>{statusText(response.status, t)}</span>{item.status === "OPEN" && new Date(item.deadline) > new Date() && response.status === "PENDING" && <div className="response-actions"><button title={t("accept")} aria-label={`${t("accept")} ${response.farmer.name}`} onClick={() => onResponseStatus(response, "ACCEPTED")}><Check size={17} /></button><button title={t("decline")} aria-label={`${t("decline")} ${response.farmer.name}`} onClick={() => onResponseStatus(response, "DECLINED")}><X size={17} /></button></div>}</div>)}</div> : <p className="empty-inline">{t("noOffers")}</p>}
    <div className="request-card-bottom"><span>Due {prettyDate(item.deadline)}</span><div className="request-owner-actions">    {item.status === "OPEN" && !item.listingId && <Link className="button button-quiet" to={`/requests/${item.id}/edit`}>{t("edit")}</Link>}<Button variant="secondary" onClick={() => onStatus(item, item.status === "OPEN" ? "CLOSED" : "OPEN")}>{item.status === "OPEN" ? t("closeRequest") : t("reopenRequest")}</Button></div></div>
  </article>;
}

function RequestForm() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const location = useLocation();
  const id = location.pathname.match(/\/requests\/([^/]+)\/edit/)?.[1];
  const [initial, setInitial] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));
  useEffect(() => {
    if (!id) return;
    api("/requests").then(({ items }) => {
      const current = items.find((item) => item.id === id);
      if (!current) throw new Error("Request not found.");
      setInitial(current);
    }).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [id]);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    body.targetPrice = body.targetPrice ? Number(body.targetPrice) : null;
    try { await api(id ? `/requests/${id}` : "/requests", { method: id ? "PATCH" : "POST", body }); navigate("/requests"); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  if (loading) return <div className="panel-loading"><span className="spinner" />{t("loading")}</div>;
  if (id && !initial) return <div className="page-content narrow-content"><ErrorNote>{error || t("noResults")}</ErrorNote><Link className="button button-secondary" to="/requests">{t("requests")}</Link></div>;
  return <div className="page-content narrow-content"><PageHeading eyebrow="BUYER WORKSPACE" title={id ? `${t("edit")} ${initial.crop}` : t("createRequest")} detail="Tell nearby growers what you are looking for." />
    <form className="form-panel" onSubmit={submit}><div className="form-section-title"><span>01</span><div><h2>What do you need?</h2><p>Share the details that help farmers make a good offer.</p></div></div>
      <div className="form-grid"><Field label={t("crop")}><input name="crop" defaultValue={initial?.crop || ""} required maxLength="100" /></Field><div className="form-two"><Field label={t("quantity")}><input name="quantity" defaultValue={initial?.quantity || ""} type="number" min="0.01" step="0.01" required /></Field><Field label={t("unit")}><select name="unit" defaultValue={initial?.unit || units[0]}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></Field></div>
        <Field label={`${t("targetPrice")} (₹ / unit)`}><input name="targetPrice" defaultValue={initial?.targetPrice || ""} type="number" min="0.01" step="0.01" /></Field>
        <div className="form-two"><Field label={t("village")}><input name="village" defaultValue={initial?.village || ""} maxLength="100" /></Field><Field label={t("district")}><select name="district" defaultValue={initial?.district || user.district || districts[0]} required>{districts.map((district) => <option key={district}>{district}</option>)}</select></Field></div>
        <Field label={t("deadline")}><input name="deadline" defaultValue={initial ? new Date(initial.deadline).toISOString().slice(0, 10) : ""} type="date" min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} required /></Field>
        <Field label={t("requirements")}><textarea name="requirements" defaultValue={initial?.requirements || ""} rows="3" maxLength="1000" placeholder="Preferred variety, quality or delivery details" /></Field>
      </div>
      <ErrorNote>{error}</ErrorNote><div className="form-actions"><Link className="button button-quiet" to="/requests">{t("cancel")}</Link><Button disabled={busy}>{busy ? t("loading") : id ? t("save") : t("createRequest")}<ArrowRight size={16} /></Button></div>
    </form>
  </div>;
}

function ProfilePage() {
  const { user, setUser } = useAuth();
  const { t } = useLanguage();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    const form = new FormData(event.currentTarget);
    const body = { name: form.get("name"), phone: form.get("phone"), village: form.get("village"), district: form.get("district"), shareContact: form.get("shareContact") === "on" };
    try { const result = await api("/auth/me", { method: "PATCH", body }); setUser(result.user); setSuccess(t("saveSuccess")); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <div className="page-content narrow-content"><PageHeading eyebrow="ACCOUNT SETTINGS" title={t("profile")} detail={t("editProfile")} />
    <form className="form-panel" onSubmit={submit}><div className="profile-intro"><span className="avatar avatar-large">{user.name.slice(0, 1)}</span><span><strong>{user.name}</strong><small>{user.role === "FARMER" ? t("farmer") : t("buyer")} · {user.email}</small></span></div>
      <div className="form-grid"><Field label={t("name")}><input name="name" key={user.name} defaultValue={user.name} required maxLength="100" /></Field><Field label={t("email")}><input value={user.email} disabled /></Field><Field label={t("phone")}><input name="phone" key={`phone-${user.phone}`} defaultValue={user.phone || ""} type="tel" /></Field><div className="form-two"><Field label={t("village")}><input name="village" key={`village-${user.village}`} defaultValue={user.village || ""} /></Field><Field label={t("district")}><select name="district" key={`district-${user.district}`} defaultValue={user.district || ""}><option value="">Choose district</option>{districts.map((d) => <option key={d}>{d}</option>)}</select></Field></div>
        <label className="check-field"><input type="checkbox" name="shareContact" defaultChecked={user.shareContact} /><span>{t("shareContact")}<small>Contact details are hidden unless you opt in.</small></span></label>
      </div><ErrorNote>{error}</ErrorNote>{success && <div className="notice notice-success"><Check size={16} />{success}</div>}
      <div className="form-actions"><Button disabled={busy}>{busy ? t("loading") : t("save")}<ArrowRight size={16} /></Button></div>
    </form>
  </div>;
}

function NotFound() {
  const { t } = useLanguage();
  return <main className="not-found"><span className="not-found-icon"><Leaf size={25} /></span><span className="eyebrow">404 · NOT FOUND</span><h1>{t("pageNotFound")}</h1><Link className="button button-primary" to="/">{t("backHome")}<ArrowRight size={16} /></Link></main>;
}

export default App;
