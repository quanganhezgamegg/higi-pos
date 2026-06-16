import { Minus, Plus, X } from 'lucide-react';
import { CartItem as CartItemType } from '../types';

interface CartItemProps {
  item: CartItemType;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
}

export function CartItem({ item, onIncrement, onDecrement, onRemove }: CartItemProps) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="size-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
        <img
          src={item.image}
          alt={item.name}
          className="size-full object-cover"
        />
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="text-sm mb-1 truncate">{item.name}</h4>
        <p className="text-sm text-gray-600">${item.price.toFixed(2)}</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onDecrement(item.id)}
          className="size-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
        >
          <Minus className="size-3.5" />
        </button>
        <span className="text-sm w-6 text-center">{item.quantity}</span>
        <button
          onClick={() => onIncrement(item.id)}
          className="size-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      <button
        onClick={() => onRemove(item.id)}
        className="size-7 rounded-full hover:bg-red-50 flex items-center justify-center text-red-600 transition-colors"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
