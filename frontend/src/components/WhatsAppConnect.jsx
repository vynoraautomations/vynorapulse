import { useState, useEffect } from 'react';
import { MessageCircle, QrCode, Check, AlertCircle, Loader, X } from 'lucide-react';
import { apiRequest } from '../services/api.js';

export default function WhatsAppConnect() {
  const [status, setStatus] = useState('disconnected');
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [connectionDetails, setConnectionDetails] = useState(null);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadStatus() {
    try {
      const res = await apiRequest('/api/whatsapp/connection-status');
      setConnectionDetails(res);
      setStatus(res.status);
      setError('');
    } catch (err) {
      console.error('Failed to load WhatsApp status:', err);
    }
  }

  async function handleConnect() {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest('/api/whatsapp/connect', {
        method: 'POST',
      });
      setQrCode(res.qr_code);
      setShowQR(true);
      setStatus('scanning');
      loadStatus();
    } catch (err) {
      setError(err.message || 'Failed to initiate WhatsApp connection');
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    setError('');
    try {
      await apiRequest('/api/whatsapp/disconnect', {
        method: 'POST',
      });
      setStatus('disconnected');
      setQrCode(null);
      setShowQR(false);
      setConnectionDetails(null);
      loadStatus();
    } catch (err) {
      setError(err.message || 'Failed to disconnect');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900/80 to-slate-950 p-8 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-4 py-1.5 text-xs font-semibold text-green-300 mb-4">
            <MessageCircle size={14} className="text-green-400" /> WHATSAPP INTEGRATION
          </div>
          <h3 className="text-2xl font-bold text-white">WhatsApp Web Connection</h3>
        </div>
        <div className={`p-3 rounded-full ${
          status === 'connected' ? 'bg-green-500/20' : 'bg-slate-700/20'
        }`}>
          {status === 'connected' ? (
            <Check size={32} className="text-green-400" />
          ) : (
            <MessageCircle size={32} className="text-slate-400" />
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 mb-6 flex items-center gap-3">
          <AlertCircle size={20} className="text-rose-400" />
          <p className="text-sm text-rose-300">{error}</p>
        </div>
      )}

      {connectionDetails && (
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs text-slate-500 mb-1 font-mono">Status</p>
            <p className="text-sm font-semibold text-white capitalize">{connectionDetails.status}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs text-slate-500 mb-1 font-mono">Phone Number</p>
            <p className="text-sm font-semibold text-white">{connectionDetails.phone_number}</p>
          </div>
          {connectionDetails.created_at && (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs text-slate-500 mb-1 font-mono">Connected Since</p>
              <p className="text-sm font-semibold text-white">
                {new Date(connectionDetails.created_at).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      )}

      {showQR && qrCode && (
        <div className="mb-6 p-6 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 flex flex-col items-center">
          <div className="flex items-center gap-2 mb-4 text-sm text-cyan-400">
            <QrCode size={18} /> Scan QR Code with WhatsApp
          </div>
          <img
            src={qrCode}
            alt="WhatsApp QR Code"
            className="w-56 h-56 rounded-xl border-4 border-cyan-500/30 p-2 bg-white"
          />
          <p className="text-xs text-slate-400 mt-4 text-center">
            Open WhatsApp on your phone and scan this QR code to connect.
          </p>
          <button
            onClick={() => setShowQR(false)}
            className="mt-4 text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2"
          >
            <X size={16} /> Hide QR Code
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {status === 'disconnected' ? (
          <button
            onClick={handleConnect}
            disabled={loading}
            className="col-span-1 sm:col-span-2 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 py-4 font-bold text-white shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:shadow-[0_0_35px_rgba(16,185,129,0.7)] hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader className="animate-spin" size={18} />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <MessageCircle size={18} />
                <span>Connect WhatsApp Web</span>
              </>
            )}
          </button>
        ) : (
          <>
            <button
              onClick={() => setShowQR(!showQR)}
              disabled={status !== 'scanning'}
              className="rounded-2xl border border-cyan-500/50 bg-cyan-500/10 py-3 font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              <QrCode size={16} /> Show QR Code
            </button>
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="rounded-2xl border border-rose-500/50 bg-rose-500/10 py-3 font-semibold text-rose-300 hover:bg-rose-500/20 transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader className="animate-spin" size={16} />
              ) : (
                <X size={16} />
              )}
              <span>{loading ? 'Disconnecting...' : 'Disconnect'}</span>
            </button>
          </>
        )}
      </div>

      <div className="mt-6 p-4 rounded-2xl border border-slate-800 bg-slate-950/60">
        <h4 className="text-sm font-semibold text-white mb-2">How it works:</h4>
        <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
          <li>Click "Connect WhatsApp Web" to generate a QR code</li>
          <li>Open WhatsApp on your phone and scan the code</li>
          <li>Confirm the connection on your phone</li>
          <li>Receive instant notifications for your emails!</li>
        </ol>
      </div>
    </div>
  );
}
