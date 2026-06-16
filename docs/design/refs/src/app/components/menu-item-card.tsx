import { Plus } from 'lucide-react';
import { MenuItem } from '../types';

interface MenuItemCardProps {
  item: MenuItem;
  onAdd: (item: MenuItem) => void;
}

export function MenuItemCard({ item, onAdd }: MenuItemCardProps) {
  return (
    <button
      onClick={() => onAdd(item)}
      className="group relative bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-200"
    >
      <div className="aspect-square overflow-hidden bg-gray-100">
        <img
          src={item.image}
          alt={item.name}
          className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      <div className="p-3">
        <h3 className="text-sm mb-1">{item.name}</h3>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">${item.price.toFixed(2)}</span>
          <div className="size-7 rounded-full bg-blue-600 flex items-center justify-center text-white group-hover:bg-blue-700 transition-colors">
            <Plus className="size-4" />
          </div>
        </div>
      </div>
    </button>
  );
}
