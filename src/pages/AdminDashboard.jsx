import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { 
  getPendingPsychologists, 
  getApprovedPsychologistsForAdmin, 
  approvePsychologist, 
  rejectPsychologist 
} from '../lib/admin';

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuth();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingList, setPendingList] = useState([]);
  const [approvedList, setApprovedList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Admin Kontrolü
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/giris');
    } else if (user?.role !== 'admin') {
      // Admin değilse ana sayfaya at
      navigate('/');
      showError('Yetkisiz Erişim', 'Bu sayfayı görüntüleme yetkiniz yok.');
    }
  }, [isAuthenticated, user, navigate, showError]);

  // Verileri Yükle
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [pending, approved] = await Promise.all([
        getPendingPsychologists(),
        getApprovedPsychologistsForAdmin()
      ]);
      setPendingList(pending || []);
      setApprovedList(approved || []);
    } catch (err) {
      console.error('Admin verileri yüklenirken hata:', err);
      showError('Hata', 'Veriler yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    if (user?.role === 'admin') {
      Promise.resolve().then(loadData);
    }
  }, [user?.role, loadData]);

  const handleApprove = async (id, name) => {
    if (!window.confirm(`${name} adlı psikoloğu ONAYLAMAK istediğinize emin misiniz?`)) return;
    
    const result = await approvePsychologist(id);
    if (result.success) {
      success('Onaylandı', `${name} artık platformda aktif.`);
      loadData(); // Listeyi yenile
    } else {
      showError('Hata', result.error);
    }
  };

  const handleReject = async (id, name, isSuspension = false) => {
    const actionText = isSuspension ? 'ASKIYA ALMAK' : 'REDDETMEK';
    if (!window.confirm(`${name} adlı psikoloğu ${actionText} istediğinize emin misiniz?`)) return;
    
    const result = await rejectPsychologist(id);
    if (result.success) {
      success('Reddedildi', `${name} adlı hesap ${isSuspension ? 'askıya alındı' : 'reddedildi'}.`);
      loadData();
    } else {
      showError('Hata', result.error);
    }
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="page">
      <Navbar />
      <main className="page-content" style={{ backgroundColor: 'var(--bg-secondary)', paddingBottom: '3rem' }}>
        <div className="container mt-xl">
          <div className="dash-header mb-2xl">
            <div>
              <h1 className="dash-title">Yönetici Paneli</h1>
              <p className="dash-subtitle">Platform istatistikleri ve psikolog başvuruları</p>
            </div>
          </div>

          {/* İstatistik Kartları */}
          <div className="grid grid-3 gap-md mb-2xl">
            <div className="card card-elevated p-lg text-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧑‍⚕️</div>
              <h3 className="m-0 text-xl">{approvedList.length}</h3>
              <p className="text-secondary text-sm">Aktif Psikolog</p>
            </div>
            <div className="card card-elevated p-lg text-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
              <h3 className="m-0 text-xl">{pendingList.length}</h3>
              <p className="text-secondary text-sm">Onay Bekleyen</p>
            </div>
            <div className="card card-elevated p-lg text-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👨‍💻</div>
              <h3 className="m-0 text-xl">Admin</h3>
              <p className="text-secondary text-sm">Yetki Seviyesi</p>
            </div>
          </div>

          <div className="card card-elevated">
            <div className="tab-navigation px-xl pt-lg border-b border-subtle">
              <button 
                className={`tab-item ${activeTab === 'pending' ? 'active' : ''}`}
                onClick={() => setActiveTab('pending')}
              >
                Onay Bekleyen Başvurular
                {pendingList.length > 0 && (
                  <span className="badge badge-warning ml-sm">{pendingList.length}</span>
                )}
              </button>
              <button 
                className={`tab-item ${activeTab === 'approved' ? 'active' : ''}`}
                onClick={() => setActiveTab('approved')}
              >
                Onaylanmış Psikologlar
              </button>
            </div>

            <div className="card-body p-0">
              {isLoading ? (
                <div className="p-2xl text-center text-secondary">Veriler yükleniyor...</div>
              ) : activeTab === 'pending' ? (
                <div className="table-responsive">
                  {pendingList.length === 0 ? (
                    <div className="p-2xl text-center text-secondary">Bekleyen başvuru bulunmamaktadır.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-tertiary)' }}>
                        <tr>
                          <th className="p-md">Tarih</th>
                          <th className="p-md">Ad Soyad</th>
                          <th className="p-md">E-Posta</th>
                          <th className="p-md">Unvan & Deneyim</th>
                          <th className="p-md text-right">İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingList.map(psych => (
                          <tr key={psych.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td className="p-md text-sm text-secondary">
                              {new Date(psych.created_at).toLocaleDateString('tr-TR')}
                            </td>
                            <td className="p-md font-semibold">{psych.display_name || 'İsimsiz'}</td>
                            <td className="p-md text-sm">{psych.email}</td>
                            <td className="p-md">
                              {psych.title} <span className="text-secondary ml-xs">({psych.experience} yıl)</span>
                            </td>
                            <td className="p-md text-right">
                              <div className="flex gap-xs justify-end">
                                <button 
                                  className="btn btn-outline btn-sm"
                                  onClick={() => handleReject(psych.id, psych.display_name)}
                                >
                                  Reddet
                                </button>
                                <button 
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleApprove(psych.id, psych.display_name)}
                                >
                                  Onayla
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : (
                <div className="table-responsive">
                  {approvedList.length === 0 ? (
                    <div className="p-2xl text-center text-secondary">Onaylanmış psikolog bulunmamaktadır.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-tertiary)' }}>
                        <tr>
                          <th className="p-md">Kayıt Tarihi</th>
                          <th className="p-md">Ad Soyad</th>
                          <th className="p-md">E-Posta</th>
                          <th className="p-md">Durum</th>
                          <th className="p-md text-right">İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {approvedList.map(psych => (
                          <tr key={psych.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td className="p-md text-sm text-secondary">
                              {new Date(psych.created_at).toLocaleDateString('tr-TR')}
                            </td>
                            <td className="p-md font-semibold">{psych.display_name || 'İsimsiz'}</td>
                            <td className="p-md text-sm">{psych.email}</td>
                            <td className="p-md">
                              <span className="badge badge-success">Aktif</span>
                            </td>
                            <td className="p-md text-right">
                              <button 
                                className="btn btn-outline btn-sm"
                                style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}
                                onClick={() => handleReject(psych.id, psych.display_name, true)}
                              >
                                Askıya Al
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
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
