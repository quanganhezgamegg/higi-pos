export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: 'coffee' | 'pastries' | 'drinks';
  image: string;
}

export interface CartItem extends MenuItem {
  quantity: number;
}
