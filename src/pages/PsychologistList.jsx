import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router';
import { SPECIALIZATIONS } from '../data/constants';
import { fetchApprovedPsychologists, getDemoPsychologists } from '../lib/psychologists';
import RatingStars from '../components/RatingStars';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { IS_DEMO_MODE } from '../config/runtime';
import { useLanguage } from '../context/LanguageContext';
import '../styles/pages/Psychologists.css';

export default function PsychologistList() {
  const { language, t } = useLanguage();
  const [psychologists, setPsychologists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedSpecs, setSelectedSpecs] = useState([]);
  const [minRating, setMinRating] = useState(0);
  const [expFilter, setExpFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('rating');

  const toggleSpec = (id) => {
    setSelectedSpecs(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  useEffect(() => {
    let isMounted = true;

    const loadPsychologists = async () => {
      setLoadError('');
      try {
        const data = await fetchApprovedPsychologists();
        if (!isMounted) return;
        setPsychologists(data.length > 0 ? data : getDemoPsychologists());
      } catch (error) {
        console.warn('Psikologlar Supabase üzerinden çekilemedi:', error);
        if (isMounted) {
          setPsychologists(getDemoPsychologists());
          setLoadError(t('catalogue.loadError'));
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadPsychologists();

    return () => {
      isMounted = false;
    };
  }, [t]);

  const filtered = useMemo(() => {
    let result = [...psychologists];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p => (
        p.name.toLowerCase().includes(q)
        || p.title.toLowerCase().includes(q)
        || p.shortBio.toLowerCase().includes(q)
      ));
    }
    if (selectedSpecs.length > 0) {
      result = result.filter(p => selectedSpecs.some(s => p.specializations.includes(s)));
    }
    if (minRating > 0) {
      result = result.filter(p => p.rating >= minRating);
    }
    if (expFilter === '1-5') result = result.filter(p => p.experience >= 1 && p.experience <= 5);
    else if (expFilter === '5-10') result = result.filter(p => p.experience > 5 && p.experience <= 10);
    else if (expFilter === '10+') result = result.filter(p => p.experience > 10);

    if (typeFilter === 'expert') result = result.filter(p => !p.isCandidate);
    else if (typeFilter === 'candidate') result = result.filter(p => p.isCandidate);

    if (sortBy === 'rating') result.sort((a, b) => b.rating - a.rating);
    else if (sortBy === 'reviews') result.sort((a, b) => b.reviewCount - a.reviewCount);
    else if (sortBy === 'experience') result.sort((a, b) => b.experience - a.experience);

    return result;
  }, [psychologists, search, selectedSpecs, minRating, expFilter, typeFilter, sortBy]);

  const getSpecLabel = (id) => t(`specializations.${id}`) || SPECIALIZATIONS.find(s => s.id === id)?.label || id;
  const getPsychologistName = (name) => {
    if (language !== 'en') return name;
    return name
      .replace('Klinik Psikolog Demo', 'Clinical Psychologist Demo')
      .replace('Aday Profil Demo', 'Candidate Profile Demo');
  };

  const clearFilters = () => {
    setSearch(''); setSelectedSpecs([]); setMinRating(0); setExpFilter('all'); setTypeFilter('all');
  };

  return (
    <div className="page">
      <Navbar />
      <main className="page-content">
        <div className="container">
          <div className="psy-header">
            <h1>{IS_DEMO_MODE ? t('catalogue.demoTitle') : t('catalogue.liveTitle')}</h1>
            <p>
              {IS_DEMO_MODE
                ? t('catalogue.demoSubtitle')
                : t('catalogue.liveSubtitle')}
            </p>
          </div>

          <div className="sidebar-layout">
            {/* Filters */}
            <aside className="sidebar psy-filters" id="psychologist-filters">
              <div className="input-group">
                <label className="sr-only" htmlFor="psy-search">{t('catalogue.search')}</label>
                <input type="text" placeholder={`🔍 ${t('catalogue.searchPlaceholder')}`} value={search} onChange={(e) => setSearch(e.target.value)} id="psy-search" />
              </div>

              <div className="filter-section">
                <h4>{t('catalogue.specialization')}</h4>
                <div className="filter-tags">
                  {SPECIALIZATIONS.slice(0, 8).map(spec => (
                    <button type="button" key={spec.id} className={`tag ${selectedSpecs.includes(spec.id) ? 'active' : ''}`} aria-pressed={selectedSpecs.includes(spec.id)} onClick={() => toggleSpec(spec.id)} id={`filter-spec-${spec.id}`}>
                      {spec.icon} {getSpecLabel(spec.id)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-section">
                <h4>{t('catalogue.minimumRating')}</h4>
                <RatingStars rating={minRating} interactive={true} onChange={setMinRating} size="md" showValue={false} />
              </div>

              <div className="filter-section">
                <h4>{t('catalogue.experience')}</h4>
                <div className="filter-radios">
                  {[{ v: 'all', l: t('catalogue.all') }, { v: '1-5', l: t('catalogue.years1to5') }, { v: '5-10', l: t('catalogue.years5to10') }, { v: '10+', l: t('catalogue.years10plus') }].map(opt => (
                    <label key={opt.v} className="radio-group">
                      <input type="radio" name="exp" checked={expFilter === opt.v} onChange={() => setExpFilter(opt.v)} /> {opt.l}
                    </label>
                  ))}
                </div>
              </div>

              <div className="filter-section">
                <h4>{t('catalogue.psychologistType')}</h4>
                <div className="filter-radios">
                  {[{ v: 'all', l: t('catalogue.all') }, { v: 'expert', l: t('catalogue.expert') }, { v: 'candidate', l: t('catalogue.candidate') }].map(opt => (
                    <label key={opt.v} className="radio-group">
                      <input type="radio" name="type" checked={typeFilter === opt.v} onChange={() => setTypeFilter(opt.v)} /> {opt.l}
                    </label>
                  ))}
                </div>
              </div>

              <button type="button" className="btn btn-ghost btn-sm btn-block" onClick={clearFilters} id="clear-filters">
                {t('catalogue.clearFilters')}
              </button>
            </aside>

            {/* Results */}
            <div className="psy-results">
              <div className="psy-toolbar">
                <span className="psy-count">{isLoading ? t('catalogue.loading') : t('catalogue.count', { count: filtered.length })}</span>
                <label className="sr-only" htmlFor="psy-sort">{t('catalogue.sorting')}</label>
                <select className="psy-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)} id="psy-sort">
                  <option value="rating">{t('catalogue.highestRating')}</option>
                  <option value="reviews">{t('catalogue.mostReviews')}</option>
                  <option value="experience">{t('catalogue.mostExperienced')}</option>
                </select>
              </div>

              <div className="psy-grid">
                {filtered.map(psych => (
                  <Link to={`/psikolog/${psych.id}`} key={psych.id} className="card card-interactive psy-card" id={`psy-card-${psych.id}`}>
                    <div className="card-body">
                      <div className="psy-card-top">
                        <div className="avatar avatar-lg">{psych.initials}</div>
                        <div className="psy-card-info">
                          <h4>{getPsychologistName(psych.name)}</h4>
                          <p className="psy-card-title">{psych.isCandidate ? t('common.candidatePsychologist') : t('common.clinicalPsychologist')}</p>
                          {psych.isDemo && <span className="badge badge-success">{t('common.demoProfile')}</span>}
                          {psych.isCandidate && <span className="badge badge-accent">{t('common.candidatePsychologist')}</span>}
                        </div>
                        <div className={`psy-status ${psych.isAvailable ? 'available' : ''}`}>
                          <span className="status-dot"></span>
                          {psych.isAvailable ? t('common.available') : t('common.busy')}
                        </div>
                      </div>
                      <div className="psy-card-specs">
                        {psych.specializations.slice(0, 3).map(s => (
                          <span key={s} className="badge badge-primary">{getSpecLabel(s)}</span>
                        ))}
                      </div>
                      <div className="psy-card-rating">
                        <RatingStars rating={psych.rating} size="sm" count={psych.reviewCount} />
                        <span className="psy-exp">{t('common.yearsExperience', { count: psych.experience })}</span>
                      </div>
                      <p className="psy-card-bio">{psych.isDemo ? t('catalogue.demoBio') : psych.shortBio}</p>
                      <span className="btn btn-outline btn-sm btn-block">{t('catalogue.viewProfile')}</span>
                    </div>
                  </Link>
                ))}
              </div>

              {!isLoading && loadError && (
                <div className="empty-state" role="alert">
                  <h3 className="empty-state-title">{t('catalogue.loadFailed')}</h3>
                  <p className="empty-state-description">{loadError}</p>
                </div>
              )}

              {!isLoading && !loadError && filtered.length === 0 && (
                <div className="empty-state">
                  <span className="empty-state-icon">🔍</span>
                  <h3 className="empty-state-title">{t('catalogue.noResults')}</h3>
                  <p className="empty-state-description">{t('catalogue.noResultsDescription')}</p>
                  <button type="button" className="btn btn-outline" onClick={clearFilters}>{t('catalogue.clearFilters')}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
