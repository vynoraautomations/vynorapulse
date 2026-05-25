import { useState } from 'react';
import { CreditCard, Check, AlertCircle, Loader, QrCode } from 'lucide-react';
import { apiRequest } from '../services/api.js';

export default function RazorpayPayment({ plan = { name: "STUDENT BASIC", amount: 2900 }, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [paymentLink, setPaymentLink] = useState(null);
  const [orderId, setOrderId] = useState(null);

  async function initiatePayment() {
    setLoading(true);
    setError('');
    try {
      // Create order
      const orderResponse = await apiRequest('/api/payments/create-order', {
        method: 'POST',
        body: JSON.stringify({
          amount: plan.amount,
          plan_id: plan.id || 'student-basic',
          plan_name: plan.name,
        }),
      });

      setOrderId(orderResponse.order_id);

      // Get payment link with QR code
      const linkResponse = await apiRequest(`/api/payments/payment-link?amount=${plan.amount}`);
      setPaymentLink(linkResponse.payment_link);
      setQrCode(linkResponse.qr_code_url);

      // Initialize Razorpay
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => {
        const options = {
          key: orderResponse.key_id,
          amount: plan.amount,
          currency: 'INR',
          name: 'Vynora Pulse',
          description: plan.name,
          order_id: orderResponse.order_id,
          handler: handlePaymentSuccess,
          prefill: {
            contact: '8106944811',
          },
          theme: {
            color: '#00F0FF',
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', handlePaymentError);
        rzp.open();
      };
      document.body.appendChild(script);
    } catch (err) {
      setError(err.message || 'Failed to initiate payment');
    } finally {
      setLoading(false);
    }
  }

  async function handlePaymentSuccess(response) {
    try {
      await apiRequest('/api/payments/verify-payment', {
        method: 'POST',
        body: JSON.stringify({
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
        }),
      });

      setSuccess(true);
      setQrCode(null);
      setPaymentLink(null);

      if (onSuccess) {
        await onSuccess();
      }
    } catch (err) {
      setError('Payment verification failed: ' + err.message);
    }
  }

  function handlePaymentError(response) {
    setError(`Payment failed: ${response.error.description}`);
  }

  return (
    <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900/80 to-slate-950 p-8 shadow-2xl">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-semibold text-cyan-300 mb-4">
          <CreditCard size={14} className="text-cyan-400" /> SECURE RAZORPAY CHECKOUT
        </div>
        <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
        <p className="text-slate-400 mt-2">₹{(plan.amount / 100).toFixed(2)} | Lifetime Access</p>
      </div>

      {success && (
        <div className="rounded-2xl border border-green-500/30 bg-green-950/20 p-4 mb-6 flex items-center gap-3">
          <Check size={24} className="text-green-400" />
          <div className="text-sm text-green-300">
            <p className="font-bold">Payment Successful! 🎉</p>
            <p className="text-slate-400 mt-1">Your subscription is now active.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 mb-6 flex items-center gap-3">
          <AlertCircle size={24} className="text-rose-400" />
          <div className="text-sm text-rose-300">
            <p className="font-bold">Payment Error</p>
            <p className="text-slate-400 mt-1">{error}</p>
          </div>
        </div>
      )}

      {qrCode && (
        <div className="mb-6 p-4 rounded-2xl border border-slate-800 bg-slate-950/60 flex flex-col items-center">
          <div className="flex items-center gap-2 mb-3 text-sm text-cyan-400">
            <QrCode size={16} /> Scan to Pay
          </div>
          <img
            src={qrCode}
            alt="Razorpay QR Code"
            className="w-40 h-40 rounded-xl border border-slate-700"
          />
          <p className="text-xs text-slate-500 mt-3">Or click button below to pay</p>
        </div>
      )}

      {paymentLink && (
        <div className="mb-6 p-4 rounded-2xl border border-slate-800 bg-slate-950/60">
          <p className="text-xs text-slate-400 mb-2">Payment Link:</p>
          <a
            href={paymentLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-cyan-400 hover:text-cyan-300 break-all font-mono"
          >
            {paymentLink}
          </a>
        </div>
      )}

      <button
        onClick={initiatePayment}
        disabled={loading || success}
        className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600 py-4 font-bold text-white shadow-[0_0_25px_rgba(0,240,255,0.4)] hover:shadow-[0_0_35px_rgba(0,240,255,0.7)] hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader className="animate-spin" size={18} />
            <span>Initializing Payment...</span>
          </>
        ) : success ? (
          <>
            <Check size={18} />
            <span>Payment Complete</span>
          </>
        ) : (
          <>
            <CreditCard size={18} />
            <span>Pay ₹{(plan.amount / 100).toFixed(2)} with Razorpay</span>
          </>
        )}
      </button>

      <p className="text-xs text-slate-500 text-center mt-4 font-mono">
        🔒 Secure payment powered by Razorpay. Contact: {plan.contact || '8106944811'}
      </p>
    </div>
  );
}
