export const PRODUCTS = [
  { name: 'Queques', price: 15 },
  { name: 'Queques de Bs13', price: 13 },
  { name: 'Rollos Pequeños', price: 17 },
  { name: 'Rollos Grandes', price: 35 },
  { name: 'Rollos de Queso pequeños de Bs.14', price: 14 },
  { name: 'Empanadas', price: 3 },
  { name: 'Empanadas a Bs3.5', price: 3.5 },
];

export const CATEGORIES = ['Gasto General', 'Material'];
export const PAYERS = ['Sra. Aurelia', 'Lesly'];

export const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
