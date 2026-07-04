import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import { Peer } from 'peerjs';
import { getSessionJoinState } from '../lib/session-flow';
import Navbar from '../components/Navbar';
import '../styles/pages/Session.css';

const BLUR_PRESETS = [
  { level: 1, label: 'Hafif', pixels: 8 },
  { level: 2, label: 'Dengeli', pixels: 12 },
  { level: 3, label: 'Güçlü', pixels: 16 },
  { level: 4, label: 'Yüksek', pixels: 22 },
  { level: 5, label: 'Maksimum', pixels: 28 },
];

const DEFAULT_BLUR_LEVEL = 5;

const getBlurPreset = (level) => (
  BLUR_PRESETS.find(preset => preset.level === Number(level)) || BLUR_PRESETS[BLUR_PRESETS.length - 1]
);

const drawCanvasNotice = (ctx, canvas, title, subtitle) => {
  ctx.filter = 'none';
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '600 28px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 10);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '18px Arial, sans-serif';
  ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 28);
};

const createSilentAudioStream = () => {
  if (typeof window === 'undefined') return null;

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return null;

  const audioContext = new AudioContextCtor();
  const source = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const destination = audioContext.createMediaStreamDestination();

  gain.gain.value = 0;
  source.connect(gain).connect(destination);
  source.start();

  return { stream: destination.stream, audioContext, source };
};

export default function SessionRoom() {
  const { user, isClient } = useAuth();
  const { updateSession, sessions, isLoadingSessions } = useSession();
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Determine session channel immediately on render
  const currentSession = sessions?.find(s => s.id.toString() === sessionId);
  const sessionChannel = currentSession?.channel || location.state?.channel || 'video-blur';
  const sessionAccess = getSessionJoinState(currentSession);
  const isWaitingForSession = user && isLoadingSessions && !currentSession;
  const isAccessBlocked = user && !isWaitingForSession && (!currentSession || !sessionAccess.canJoin);
  const panelPath = isClient ? '/panel' : '/psikolog-panel';
  const isMockUser = user?.id?.startsWith('mock-');
  const shouldUseBlurStream = isClient && sessionChannel === 'video-blur';
  const connectingStatusLabel = sessionChannel === 'text'
    ? 'Sohbet Bağlanıyor...'
    : sessionChannel === 'voice'
      ? 'Mikrofon Bağlanıyor...'
      : 'Kamera Bağlanıyor...';

  const [blurLevel, setBlurLevel] = useState(DEFAULT_BLUR_LEVEL);
  const blurLevelRef = useRef(DEFAULT_BLUR_LEVEL);
  const activeBlurPreset = getBlurPreset(blurLevel);
  
  const handleBlurChange = (val) => {
    const requestedLevel = Number(val);
    const nextLevel = BLUR_PRESETS.some(preset => preset.level === requestedLevel)
      ? requestedLevel
      : DEFAULT_BLUR_LEVEL;
    setBlurLevel(nextLevel);
    blurLevelRef.current = nextLevel;
  };
  
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: 'Odaya bağlanılıyor...', sender: 'system', time: new Date().toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'}) }
  ]);
  const [chatInput, setChatInput] = useState('');
  
  const [sessionStatus, setSessionStatus] = useState('connecting'); // connecting, ready, active
  const [sessionTime, setSessionTime] = useState(0);
  const [remoteVideoReady, setRemoteVideoReady] = useState(false);
  const [remoteVideoMissing, setRemoteVideoMissing] = useState(false);
  const [mediaFallbackActive, setMediaFallbackActive] = useState(false);
  
  const [pipMode, setPipMode] = useState('safe');
  const pipModeRef = useRef('safe');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const camOnRef = useRef(true);

  // Refs for WebRTC & Canvas
  const peerRef = useRef(null);
  const connRef = useRef(null);
  const callRef = useRef(null);
  
  const localStreamRef = useRef(null); // Real camera stream
  const blurStreamRef = useRef(null);  // Processed canvas stream
  
  const hiddenVideoRef = useRef(null); // Used to draw to canvas
  const canvasRef = useRef(null);
  
  const remoteVideoRef = useRef(null); // Big screen (other person)
  const pipVideoRef = useRef(null);    // Small screen (me)

  const animationFrameId = useRef(null);
  const retryTimerRef = useRef(null);
  const fallbackAudioContextRef = useRef(null);
  const fallbackAudioNodeRef = useRef(null);
  const mediaFallbackNoticeShownRef = useRef(false);
  const demoModeRef = useRef(false);

  const closeFallbackAudio = useCallback(() => {
    try {
      fallbackAudioNodeRef.current?.stop?.();
    } catch {
      // The generated test source may already be stopped during cleanup.
    }

    const fallbackAudioContext = fallbackAudioContextRef.current;
    if (fallbackAudioContext && fallbackAudioContext.state !== 'closed') {
      void fallbackAudioContext.close().catch(() => {});
    }

    fallbackAudioContextRef.current = null;
    fallbackAudioNodeRef.current = null;
  }, []);

  const syncPipPreview = useCallback(() => {
    if (!pipVideoRef.current) return;
    const nextStream = pipModeRef.current === 'raw'
      ? localStreamRef.current
      : (blurStreamRef.current || localStreamRef.current);

    if (pipVideoRef.current.srcObject !== nextStream) {
      pipVideoRef.current.srcObject = nextStream || null;
    }
  }, []);

  // Determine fixed IDs for Demo purposes
  // In a real app, this would be a UUID generated by the backend
  const ROOM_ID = sessionId || 'gizlibiriz-demo-room';
  const myPeerId = isClient ? `${ROOM_ID}-client` : `${ROOM_ID}-psychologist`;
  const targetPeerId = isClient ? `${ROOM_ID}-psychologist` : `${ROOM_ID}-client`;

  // Draw loop for Canvas Blur
  const drawToCanvas = useCallback(function drawFrame() {
    if (!hiddenVideoRef.current || !canvasRef.current) return;
    const video = hiddenVideoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const videoReady = video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
    const nextWidth = videoReady ? video.videoWidth : 1280;
    const nextHeight = videoReady ? video.videoHeight : 720;
    
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!camOnRef.current) {
      drawCanvasNotice(ctx, canvas, 'Kamera kapalı', 'Gizlilik modu aktif');
    } else if (!videoReady) {
      drawCanvasNotice(ctx, canvas, 'Kamera hazırlanıyor', 'Güvenli görüntü oluşturuluyor');
    } else {
      const pxBlur = getBlurPreset(blurLevelRef.current).pixels;
      const bleed = Math.ceil(pxBlur * 2);
      ctx.filter = `blur(${pxBlur}px)`;
      ctx.drawImage(video, -bleed, -bleed, canvas.width + bleed * 2, canvas.height + bleed * 2);
      ctx.filter = 'none';
    }

    ctx.restore();

    animationFrameId.current = requestAnimationFrame(drawFrame);
  }, []);

  const addSystemMessage = useCallback((text) => {
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(), text, sender: 'system', time: new Date().toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})
    }]);
  }, []);

  const markRemoteUnavailable = useCallback((message = "Karşı taraf bağlantısı kesildi. Yeniden bağlanması bekleniyor...") => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setRemoteVideoReady(false);
    setRemoteVideoMissing(sessionChannel === 'video-blur');
    setSessionStatus('ready');
    addSystemMessage(message);
  }, [addSystemMessage, sessionChannel]);

  const handleDataConnection = useCallback((conn) => {
    connRef.current = conn;

    const markOpen = () => {
      addSystemMessage("Sohbet bağlantısı kuruldu.");
      if (sessionChannel === 'text') {
        setSessionStatus('active');
      }
    };

    if (conn.open) {
      markOpen();
    } else {
      conn.on('open', markOpen);
    }

    conn.on('data', (data) => {
      setMessages(prev => [...prev, data]);
    });
  }, [addSystemMessage, sessionChannel]);

  const attachRemoteStream = useCallback((remoteStream) => {
    const remoteElement = remoteVideoRef.current;
    if (!remoteElement) return;

    if (remoteElement.srcObject !== remoteStream) {
      remoteElement.srcObject = remoteStream;
    }
    demoModeRef.current = false;

    const hasVideoTrack = remoteStream.getVideoTracks().length > 0;
    setRemoteVideoMissing(sessionChannel === 'video-blur' && !hasVideoTrack);
    setRemoteVideoReady(sessionChannel !== 'video-blur');

    remoteStream.getVideoTracks().forEach((track) => {
      track.onended = () => markRemoteUnavailable("Karşı tarafın kamera bağlantısı kapandı. Yeniden bağlanması bekleniyor...");
      track.onmute = () => setRemoteVideoReady(false);
      track.onunmute = () => setRemoteVideoReady(true);
    });

    if (sessionChannel === 'video-blur' && hasVideoTrack) {
      void remoteElement.play?.()
        .then(() => setRemoteVideoReady(true))
        .catch(() => {
          setRemoteVideoReady(false);
          addSystemMessage('Görüntü otomatik başlatılamadı. Tarayıcı izinlerini kontrol edin.');
        });
    }

    setSessionStatus('active');
    addSystemMessage("Görüşme başladı!");
  }, [addSystemMessage, markRemoteUnavailable, sessionChannel]);

  useEffect(() => {
    if (!user) return;
    if (isWaitingForSession) return;
    if (!currentSession && !isMockUser && !location.state?.channel) {
      navigate(isClient ? '/panel' : '/psikolog-panel', { replace: true });
    }
  }, [currentSession, isClient, isMockUser, isWaitingForSession, location.state, navigate, user]);

  // Setup Camera and Streams
  useEffect(() => {
    if (isAccessBlocked) return undefined;

    const isMounted = { current: true };
    const initCamera = async () => {
      // Eğer sadece metin (yazışma) ise, kamerayı ve mikrofonu hiç isteme!
      if (sessionChannel === 'text') {
        initPeer();
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: sessionChannel === 'video-blur', // Sadece video seansında kamera aç
          audio: true 
        });
        setMediaFallbackActive(false);
        localStreamRef.current = stream;

        if (shouldUseBlurStream) {
          // Blur işleme mekanizması (Sadece video ise)
          if (hiddenVideoRef.current) {
            hiddenVideoRef.current.srcObject = stream;
            void hiddenVideoRef.current.play().catch(() => {});
          }
          drawToCanvas();

          if (canvasRef.current) {
            const canvasStream = canvasRef.current.captureStream(30);
            stream.getAudioTracks().forEach(track => canvasStream.addTrack(track));
            blurStreamRef.current = canvasStream;
          }
          syncPipPreview();
        } else {
          // Audio-only ise blur'a gerek yok
          syncPipPreview();
        }
      } catch (err) {
        console.error("Medya akışı açılamadı:", err);
        const blockedDeviceLabel = sessionChannel === 'voice' ? 'Mikrofon' : 'Kamera veya mikrofon';
        setMediaFallbackActive(true);
        if (!mediaFallbackNoticeShownRef.current) {
          addSystemMessage(`${blockedDeviceLabel} izni alınamadı. Seans odası kontrollü test akışıyla açılıyor...`);
          mediaFallbackNoticeShownRef.current = true;
        }
        
        // Donanım izni yoksa oda yine kontrollü şekilde açılabilsin.
        try {
          closeFallbackAudio();
          const silentAudio = createSilentAudioStream();

          if (silentAudio) {
            fallbackAudioContextRef.current = silentAudio.audioContext;
            fallbackAudioNodeRef.current = silentAudio.source;
          }

          if (sessionChannel === 'voice') {
            localStreamRef.current = silentAudio?.stream || null;
          } else {
            const canvas = document.createElement('canvas');
            canvas.width = 640; canvas.height = 480;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#333333';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#ffffff';
            ctx.font = '24px Arial';
            ctx.fillText('Kamera Kullanılamıyor', 170, 240);
            const fakeStream = canvas.captureStream(15);
            silentAudio?.stream.getAudioTracks().forEach(track => fakeStream.addTrack(track));
            localStreamRef.current = fakeStream;
            blurStreamRef.current = fakeStream;
          }

          syncPipPreview();
        } catch (e) {
          console.error("Sahte stream oluşturulamadı:", e);
        }
        
        setSessionStatus('ready');
      } finally {
        // React StrictMode causes useEffect to run twice. 
        // We add a delay to allow the PeerJS server to drop the old connection before trying to claim the same ID again.
        setTimeout(() => {
          if (!isMounted.current) return;
          initPeer();
        }, 1500);
      }
    };

    const scheduleClientReconnect = () => {
      if (!isClient || sessionChannel === 'text') return;
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => {
        if (!isMounted.current || !peerRef.current || peerRef.current.destroyed) return;
        if (connRef.current?.open || callRef.current) return;
        connectToPeer(peerRef.current);
      }, 2000);
    };

    const markCallClosed = (call) => {
      if (!isMounted.current) return;
      if (callRef.current === call) {
        callRef.current = null;
      }
      markRemoteUnavailable();
      scheduleClientReconnect();
    };

    const bindCallHandlers = (call) => {
      callRef.current = call;
      call.on('stream', attachRemoteStream);
      call.on('close', () => markCallClosed(call));
      call.on('error', () => markCallClosed(call));
    };

    const bindConnectionHandlers = (conn) => {
      conn.on('close', () => {
        if (!isMounted.current) return;
        if (connRef.current === conn) {
          connRef.current = null;
        }

        if (!callRef.current) {
          markRemoteUnavailable();
          scheduleClientReconnect();
        }
      });
    };

    const initPeer = () => {
      // Danışan (Client) tarafı rastgele (anonim) ID ile sunucuya bağlanır. 
      // Böylece sayfa yenilemelerinde "ID is taken" hatası ASLA yaşamaz.
      // Psikolog ise sabit ID'yi alarak bekleyen (dinleyen) taraf olur.
      const peerConfig = { debug: 2 };
      const peer = isClient ? new Peer(peerConfig) : new Peer(myPeerId, peerConfig);

      peerRef.current = peer;

      peer.on('open', () => {
        setSessionStatus('ready');
        addSystemMessage("Sunucuya bağlanıldı. Karşı taraf bekleniyor...");
        
        // Client initiates the call to Psychologist
        if (isClient) {
          const tryConnect = () => {
            if (callRef.current || connRef.current?.open) return; // Zaten bağlıysa iptal
            connectToPeer(peer);
            retryTimerRef.current = setTimeout(tryConnect, 3000); // 3 saniyede bir yokla
          };
          tryConnect();
        }
      });

      // When Psychologist receives connection/call from Client
      peer.on('connection', (conn) => {
        handleDataConnection(conn);
        bindConnectionHandlers(conn);
      });

      peer.on('call', (call) => {
        // Answer with my stream (Eğer video-blur ise blurStream, değilse localStream(sadece ses))
        const myStream = shouldUseBlurStream ? blurStreamRef.current : localStreamRef.current;
        
        // Metin modunda call gelmemeli ama gelirse boş stream dön
        if (sessionChannel === 'text' || !myStream) return;
        
        call.answer(myStream);
        bindCallHandlers(call);
      });

      peer.on('error', (err) => {
        console.error("PeerJS Error:", err);
        // Eğer Psikolog'un sabit ID'si "is taken" ise (sayfa yenileme çakışması) 
        // pes etme, 2 saniye bekle ve sunucu temizlenince tekrar dene.
        if (err.type === 'unavailable-id' && !isClient) {
          addSystemMessage("Sunucu eski bağlantınızı temizliyor, 2 saniye içinde tekrar bağlanılacak...");
          setTimeout(() => {
            if (isMounted.current) {
              initPeer();
            }
          }, 2000);
        }
      });
    };

    const connectToPeer = (peer) => {
      // Connect Data
      const conn = peer.connect(targetPeerId);
      
      conn.on('open', () => {
        handleDataConnection(conn);
        bindConnectionHandlers(conn);
        connRef.current = conn;
        clearTimeout(retryTimerRef.current);
        
        // Connect Media ONLY after Data is established
        if (sessionChannel === 'text') return; // Metinse burada bitir

        const myStream = shouldUseBlurStream ? blurStreamRef.current : localStreamRef.current;
        if (myStream && !callRef.current) {
          const call = peer.call(targetPeerId, myStream);
          bindCallHandlers(call);
        }
      });
      
      conn.on('error', (err) => {
        console.log("Bağlantı denemesi (karşı taraf henüz yok):", err);
      });
    };

    initCamera();

    return () => {
      isMounted.current = false;
      clearTimeout(retryTimerRef.current);
      cancelAnimationFrame(animationFrameId.current);
      if (callRef.current) {
        callRef.current.close();
      }
      if (connRef.current) {
        connRef.current.close();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (blurStreamRef.current && blurStreamRef.current !== localStreamRef.current) {
        blurStreamRef.current.getTracks().forEach(t => t.stop());
      }
      closeFallbackAudio();
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, [sessionId, sessionChannel, isClient, myPeerId, targetPeerId, drawToCanvas, handleDataConnection, attachRemoteStream, addSystemMessage, markRemoteUnavailable, isAccessBlocked, shouldUseBlurStream, syncPipPreview, closeFallbackAudio]); // Run correctly with dependencies

  useEffect(() => {
    pipModeRef.current = pipMode;
    syncPipPreview();
  }, [pipMode, syncPipPreview]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const msg = {
      id: crypto.randomUUID(),
      text: chatInput,
      sender: isClient ? 'client' : 'psychologist',
      time: new Date().toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})
    };

    setMessages(prev => [...prev, msg]);
    if (connRef.current && connRef.current.open) {
      connRef.current.send(msg);
    } else {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), text: 'Karşı taraf odada olmadığı için mesajınız iletilemedi.', sender: 'system', time: new Date().toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})
      }]);
    }
    setChatInput('');
  };

  // Timer
  useEffect(() => {
    let interval = null;
    if (sessionStatus === 'active') {
      interval = setInterval(() => {
        setSessionTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [sessionStatus]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const toggleMic = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !micOn;
      setMicOn(!micOn);
    }
  };

  const toggleCam = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      const nextCamOn = !camOn;
      videoTrack.enabled = nextCamOn;
      camOnRef.current = nextCamOn;
      setCamOn(nextCamOn);
    }
  };

  const endCall = async () => {
    if (callRef.current) callRef.current.close();
    if (connRef.current) connRef.current.close();
    if (peerRef.current) peerRef.current.destroy();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (blurStreamRef.current && blurStreamRef.current !== localStreamRef.current) {
      blurStreamRef.current.getTracks().forEach(track => track.stop());
    }
    closeFallbackAudio();
    if (currentSession?.status === 'upcoming' && sessionStatus === 'active' && !demoModeRef.current) {
      await updateSession(currentSession.id, { status: 'completed', completedAt: new Date().toISOString() });
    }
    navigate(isClient ? '/panel' : '/psikolog-panel');
  };

  const startDemoMode = () => {
    if (!import.meta.env.DEV) return;
    const demoStream = shouldUseBlurStream
      ? blurStreamRef.current
      : localStreamRef.current;

    if (remoteVideoRef.current && demoStream) {
      demoModeRef.current = true;
      remoteVideoRef.current.srcObject = demoStream;
      setRemoteVideoMissing(false);
      setRemoteVideoReady(true);
      setSessionStatus('active');
      addSystemMessage("Simülasyon modu başlatıldı. Büyük ekranda karşı tarafa gidecek güvenli seans akışı gösteriliyor.");
    } else {
      addSystemMessage("Demo başlatılamadı: Kamera kapalı.");
    }
  };

  const showRemoteVideoOverlay = sessionChannel === 'video-blur'
    && (sessionStatus !== 'active' || remoteVideoMissing || !remoteVideoReady);
  const remoteVideoOverlayText = sessionStatus === 'active'
    ? (remoteVideoMissing ? 'Karşı tarafın kamera görüntüsü bekleniyor...' : 'Görüntü hazırlanıyor...')
    : (sessionStatus === 'ready' ? 'Karşı tarafın bağlanması bekleniyor...' : 'Bağlanılıyor...');
  const remoteVideoOverlayDetail = mediaFallbackActive
    ? 'Bu cihazda kamera veya mikrofon izni alınamadı. Oda test akışıyla açık kalıyor.'
    : 'Diğer taraf aynı randevuya girdiğinde görüntü burada açılacak.';

  if (isWaitingForSession) {
    return (
      <div className="session-room session-room-blocked">
        <Navbar />
        <main className="session-access-main">
          <section className="session-access-panel">
            <span className="session-access-eyebrow">Seans Girişi</span>
            <h1>Randevu hazırlanıyor</h1>
            <p>Seans bilgileri yükleniyor. Birkaç saniye içinde oda açılacak.</p>
          </section>
        </main>
      </div>
    );
  }

  if (isAccessBlocked) {
    return (
      <div className="session-room session-room-blocked">
        <Navbar />
        <main className="session-access-main">
          <section className="session-access-panel">
            <span className="session-access-eyebrow">Seans Girişi</span>
            <h1>{sessionAccess.label}</h1>
            <p>{currentSession ? sessionAccess.helper : 'Bu randevu kaydı bulunamadı veya artık erişilebilir değil.'}</p>
            {currentSession && (
              <div className="session-access-summary">
                <div>
                  <span>Tarih</span>
                  <strong>{new Date(`${currentSession.date}T12:00:00`).toLocaleDateString('tr-TR')}</strong>
                </div>
                <div>
                  <span>Saat</span>
                  <strong>{currentSession.time}</strong>
                </div>
                <div>
                  <span>Ödeme</span>
                  <strong>{currentSession.paymentStatus === 'paid' ? 'Alındı' : 'Bekliyor'}</strong>
                </div>
              </div>
            )}
            <div className="session-access-actions">
              <button type="button" className="btn btn-primary" onClick={() => navigate(panelPath)}>
                Panele Dön
              </button>
              {isClient && currentSession?.status === 'completed' && !currentSession.reviewed && (
                <button type="button" className="btn btn-outline" onClick={() => navigate(`/degerlendirme?session=${currentSession.id}`)}>
                  Değerlendir
                </button>
              )}
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="session-room">
      <Navbar />
      
      {/* Invisible video/canvas for Blur Processing */}
      <div style={{ display: 'none' }}>
        <video ref={hiddenVideoRef} muted autoPlay playsInline />
        <canvas ref={canvasRef} />
      </div>

      {/* Header */}
      <header className="session-header">
        <div className="session-header-left">
          <div className={`session-status ${sessionStatus === 'active' ? 'active' : ''}`}>
            <span className="status-dot"></span>
            {sessionStatus === 'connecting' ? connectingStatusLabel : 
             sessionStatus === 'ready' ? 'Karşı Taraf Bekleniyor' : 'Bağlantı Aktif'}
          </div>
          <div className="session-timer">{formatTime(sessionTime)}</div>
        </div>
        <div className="session-with">
          {isClient ? 'Psikolog ile Görüşme' : 'Danışan ile Görüşme'}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setIsChatOpen(!isChatOpen)}>
          💬 Sohbet {messages.length > 1 ? `(${messages.length-1})` : ''}
        </button>
      </header>

      {/* Main Area */}
      <div className="session-content" style={{ display: sessionChannel === 'text' ? 'block' : 'flex' }}>
        
        {/* Video or Audio Container */}
        {sessionChannel === 'text' ? null : sessionChannel === 'voice' ? (
          <div className="session-video-area" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
            <audio ref={remoteVideoRef} autoPlay playsInline />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '6rem', margin: '0 auto', opacity: sessionStatus === 'active' ? 1 : 0.5, animation: sessionStatus === 'active' ? 'pulse 2s infinite' : 'none' }}>🎙️</div>
              <h3 className="mt-md">Sadece Sesli Görüşme</h3>
              <p className="text-tertiary">Kamera gizlilik nedeniyle kapalıdır.</p>
              {sessionStatus !== 'active' && <p style={{ color: 'var(--primary)' }}>Bağlanılıyor...</p>}
            </div>
          </div>
        ) : (
          <div className={`session-video-area ${showRemoteVideoOverlay ? 'waiting' : ''}`}>
            <div className="video-placeholder">
              <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                className="video-main"
                onCanPlay={() => setRemoteVideoReady(true)}
                onLoadedData={() => setRemoteVideoReady(true)}
                onPlaying={() => setRemoteVideoReady(true)}
                onWaiting={() => setRemoteVideoReady(false)}
                style={{ objectFit: 'contain', width: '100%', height: '100%', borderRadius: 'var(--radius-lg)' }}
              />
              {showRemoteVideoOverlay && (
                <div className="remote-video-state">
                  <div className="remote-video-state-card">
                    <span className="remote-video-state-icon">⌛</span>
                    <div>
                      <div className="video-name">{remoteVideoOverlayText}</div>
                      <p className="video-subtitle">{remoteVideoOverlayDetail}</p>
                    </div>
                  </div>
                  <div className="remote-video-state-actions">
                    {mediaFallbackActive && (
                      <span className="media-fallback-badge">Kamera izni bekleniyor</span>
                    )}
                    {import.meta.env.DEV && (
                      <button className="btn btn-primary" onClick={startDemoMode}>
                        🎥 Simülasyon (Test) Modunu Başlat
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Picture in Picture (Self) */}
            <div className="video-pip">
              <video 
                ref={pipVideoRef} 
                autoPlay 
                playsInline 
                muted 
                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
              />
              <span className="pip-label">Siz</span>
            </div>
          </div>
        )}

        {/* Blur Controls (Sadece Görüntülü görüşmede) */}
        {shouldUseBlurStream && (
          <div className="blur-control">
            <div className="blur-control-header">
              <div>
                <span className="blur-eyebrow">Güvenli Kamera</span>
                <strong>{activeBlurPreset.label}</strong>
              </div>
              <span className="blur-strength">{activeBlurPreset.pixels}px</span>
            </div>

            <label className="blur-label" htmlFor="session-blur-level">
              Bulanıklık
              <span>{blurLevel}/5</span>
            </label>
            <div className="blur-slider-wrapper">
              <span className="blur-min">Az</span>
              <input
                id="session-blur-level"
                type="range"
                className="blur-slider"
                min="1"
                max="5"
                step="1"
                value={blurLevel}
                onChange={(e) => handleBlurChange(e.target.value)}
                aria-label="Bulanıklık seviyesi"
              />
              <span className="blur-max">Gizli</span>
            </div>

            <div className="blur-level-buttons" aria-label="Bulanıklık seviyesi seçenekleri">
              {BLUR_PRESETS.map(preset => (
                <button
                  key={preset.level}
                  type="button"
                  className={`blur-level-button ${blurLevel === preset.level ? 'active' : ''}`}
                  aria-pressed={blurLevel === preset.level}
                  onClick={() => handleBlurChange(preset.level)}
                >
                  {preset.level}
                </button>
              ))}
            </div>
          
            <div className="blur-preview-row">
              <span>Önizleme</span>
              <div className="blur-segmented">
                <button
                  type="button"
                  className={pipMode === 'safe' ? 'active' : ''}
                  onClick={() => setPipMode('safe')}
                >
                  Güvenli
                </button>
                <button
                  type="button"
                  className={pipMode === 'raw' ? 'active' : ''}
                  onClick={() => setPipMode('raw')}
                >
                  Net
                </button>
              </div>
            </div>

            <div className="blur-send-status">
              <span>Giden görüntü</span>
              <strong>Blurlu</strong>
            </div>
          </div>
        )}

        {/* Chat Panel */}
        <div className={`session-chat ${isChatOpen || sessionChannel === 'text' ? 'open' : ''}`} style={sessionChannel === 'text' ? { position: 'relative', width: '100%', height: '100%', borderLeft: 'none', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)' } : {}}>
          <div className="chat-header">
            <h4>Seans Sohbeti</h4>
            <button className="btn-ghost" onClick={() => setIsChatOpen(false)}>✕</button>
          </div>
          
          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-message ${m.sender === 'system' ? 'system' : (m.sender === (isClient ? 'client' : 'psychologist') ? 'client' : 'psychologist')}`} style={{ textAlign: m.sender === 'system' ? 'center' : 'left' }}>
                {m.sender === 'system' ? (
                  <span style={{ fontSize: '10px', color: '#94a3b8', margin: '4px 0' }}>--- {m.text} ---</span>
                ) : (
                  <div className="message-bubble" style={{ alignSelf: m.sender === (isClient ? 'client' : 'psychologist') ? 'flex-end' : 'flex-start' }}>
                    <p>{m.text}</p>
                    <span className="message-time">{m.time}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <form className="chat-input" onSubmit={sendMessage}>
            <input 
              type="text" 
              placeholder="Mesaj yazın..." 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">Gönder</button>
          </form>
        </div>
      </div>

      {/* Bottom Controls */}
      <footer className="session-controls">
        <div className="controls-group">
          {/* Empty space for flex layout */}
        </div>
        
        <div className="controls-group">
          <button className={`control-btn ${!micOn ? 'off' : ''}`} onClick={toggleMic} title="Mikrofon" disabled={sessionChannel === 'text'}>
            {micOn ? '🎙️' : '🔇'}
            <span>{sessionChannel === 'text' ? 'Kapalı' : (micOn ? 'Açık' : 'Kapalı')}</span>
          </button>
          
          <button className={`control-btn ${!camOn ? 'off' : ''}`} onClick={toggleCam} title="Kamera" disabled={sessionChannel !== 'video-blur'}>
            {camOn ? '📹' : '🚫'}
            <span>{sessionChannel !== 'video-blur' ? 'Kapalı' : (camOn ? 'Açık' : 'Kapalı')}</span>
          </button>
          
          <button className="control-btn emergency" onClick={endCall} title="Aramayı Sonlandır">
            📞
            <span>Kapat</span>
          </button>
        </div>

        <div className="controls-group">
          <button className={`control-btn ${isChatOpen ? 'active' : ''}`} onClick={() => setIsChatOpen(!isChatOpen)}>
            💬
            <span>Sohbet</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
