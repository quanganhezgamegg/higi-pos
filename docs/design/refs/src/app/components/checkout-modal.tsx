import { CheckCircle, X } from 'lucide-react';
import { CartItem } from '../types';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  total: number;
}

export function CheckoutModal({ isOpen, onClose, items, total }: CheckoutModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl">Order Complete</h2>
            <button
              onClick={onClose}
              className="size-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex flex-col items-center mb-6">
            <div className="size-16 rounded-full bg-green-100 flex items-center justify-center mb-3">
              <CheckCircle className="size-9 text-green-600" />
            </div>
            <h3 className="text-lg mb-1">Payment Successful!</h3>
            <p className="text-sm text-gray-600">Order #12345</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h4 className="text-sm mb-3">Order Summary</h4>
            <div className="space-y-2 mb-3">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {item.quantity}x {item.name}
                  </span>
                  <span>${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-gray-200 flex justify-between">
              <span>Total Paid</span>
              <span className="text-lg">${total.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg transition-colors"
          >
            New Order
          </button>
        </div>
      </div>
    </div>
  );
}
